// Copyright © 2026 Mcont.

import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

/** Promise-based process runner for package packing. */
const execFileAsync = promisify(execFile);

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** SDK packages that are packed for the consumer. */
const packagesRoot = path.join(workspaceRoot, "packages");

/** Temporary Node consumer. It is not part of the workspace package graph. */
const consumerRoot = path.join(workspaceRoot, ".artifacts", "node-consumer");

/** Node entry file selected by the package exports. */
const NODE_ENTRY_FILE = "node.js";

/** Factory module that must bind the Node transport. */
const NODE_CLIENT_FILE = "node-client.js";

/** Transport that the Node entry is allowed to construct. */
const NODE_TRANSPORT = "NodeFetchTransport";

/** Transport that must stay on the browser entry. */
const BROWSER_TRANSPORT = "BrowserFetchTransport";

/**
 * Narrows parsed JSON to a non-null record.
 *
 * @param {unknown} value Parsed manifest value.
 * @returns {value is Record<string, unknown>} Whether the value is a record.
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks the Node entry and the factory it re-exports.
 *
 * @param {string} entrySource Source of the resolved `node.js` entry.
 * @param {string} clientSource Source of `node-client.js` beside that entry.
 */
export function assertNodeEntry(entrySource, clientSource) {
  if (entrySource.includes(BROWSER_TRANSPORT) || !entrySource.includes(NODE_CLIENT_FILE)) {
    throw new Error("The Node entry does not stay on the Node client factory.");
  }
  if (!clientSource.includes(NODE_TRANSPORT) || clientSource.includes(BROWSER_TRANSPORT)) {
    throw new Error("The Node client factory does not bind the Node Fetch transport.");
  }
}

/**
 * Packs every SDK package into the consumer node_modules.
 */
async function installPackedPackages() {
  const packageDirectories = (await readdir(packagesRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const packageDirectory of packageDirectories) {
    const packageRoot = path.join(packagesRoot, packageDirectory);
    const manifest = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
    if (!isRecord(manifest) || typeof manifest.name !== "string") {
      throw new Error(`Package ${packageDirectory} has no name.`);
    }

    const tarball = path.join(consumerRoot, `${packageDirectory}.tgz`);
    await execFileAsync("pnpm", ["pack", "--out", tarball], {
      cwd: packageRoot,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });

    const extractRoot = path.join(consumerRoot, "extract", packageDirectory);
    await mkdir(extractRoot, { recursive: true });
    await execFileAsync("tar", ["-xzf", tarball, "-C", extractRoot]);

    const [, packagePathName] = manifest.name.split("/");
    if (packagePathName === undefined) {
      throw new Error(`Package '${manifest.name}' is not scoped.`);
    }
    const destination = path.join(consumerRoot, "node_modules", "@evolutos", packagePathName);
    await mkdir(path.dirname(destination), { recursive: true });
    await rm(destination, { recursive: true, force: true });
    await rename(path.join(extractRoot, "package"), destination);
  }
}

/**
 * Resolves the packed client from a Node process whose cwd is the consumer.
 */
async function checkNodeConsumer() {
  await rm(consumerRoot, { recursive: true, force: true });
  await mkdir(consumerRoot, { recursive: true });
  await installPackedPackages();
  await writeFile(
    path.join(consumerRoot, "package.json"),
    `${JSON.stringify({ name: "mconet-node-consumer", private: true, type: "module" }, null, 2)}\n`,
  );

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      'process.stdout.write(import.meta.resolve("@evolutos/mconet-client"));',
    ],
    { cwd: consumerRoot, encoding: "utf8" },
  );

  const entryPath = fileURLToPath(stdout);
  if (path.basename(entryPath) !== NODE_ENTRY_FILE) {
    throw new Error(`Node resolved the client to '${entryPath}'.`);
  }

  const entrySource = await readFile(entryPath, "utf8");
  const clientSource = await readFile(path.join(path.dirname(entryPath), NODE_CLIENT_FILE), "utf8");
  assertNodeEntry(entrySource, clientSource);
  process.stdout.write("Node consumer resolved the packed Node client entry.\n");
}

/**
 * Proves the entry check accepts the Node factory and rejects the browser transport.
 */
function selfTest() {
  assertNodeEntry(
    'export { createDefaultClient } from "./node-client.js";',
    "new NodeFetchTransport({})",
  );

  let rejected = false;
  try {
    assertNodeEntry(
      'export { createDefaultClient } from "./node-client.js";',
      "new BrowserFetchTransport({})",
    );
  } catch (error) {
    rejected = error instanceof Error;
  }
  if (!rejected) {
    throw new Error("Node consumer self-test accepted the browser transport.");
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/check-node-consumer.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTest();
} else {
  await checkNodeConsumer();
}
