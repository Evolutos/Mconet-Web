// Copyright © 2026 Mcont.

import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

/** Promise-based process runner for pack and Vite. */
const execFileAsync = promisify(execFile);

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** SDK packages that are packed for the consumer. */
const packagesRoot = path.join(workspaceRoot, "packages");

/** Consumer kept inside the workspace so Vite can be resolved without publishing it. */
const consumerRoot = path.join(workspaceRoot, ".artifacts", "vite-consumer");

/** Vite binary installed for the workspace examples. */
const viteBin = path.join(workspaceRoot, "node_modules", ".bin", "vite");

/** Name that must survive the browser bundle because the entry calls it. */
const REQUIRED_BROWSER_EXPORT = "createDefaultClient";

/** Class that proves the browser transport was the selected implementation. */
const REQUIRED_BROWSER_TRANSPORT = "BrowserFetchTransport";

/** Node transport name that must not be reachable from the browser entry. */
const FORBIDDEN_NODE_TRANSPORT = "NodeFetchTransport";

/**
 * Import or require of a Node built-in. A property named `node` is not a module
 * specifier, so the check looks for a quoted `node:` module id.
 */
const NODE_BUILTIN_IMPORT = /(?:import\s*(?:[^"'()]*from\s*)?|require\s*\()\s*["']node:/;

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
 * Rejects a browser bundle that missed the browser entry or pulled in Node.
 *
 * @param {string} source Built JavaScript.
 */
export function assertBrowserBundle(source) {
  if (!source.includes(REQUIRED_BROWSER_EXPORT)) {
    throw new Error("The Vite bundle does not include the browser client entry.");
  }
  if (!source.includes(REQUIRED_BROWSER_TRANSPORT)) {
    throw new Error("The Vite bundle does not include the browser Fetch transport.");
  }
  if (source.includes(FORBIDDEN_NODE_TRANSPORT)) {
    throw new Error("The Vite bundle includes the Node Fetch transport.");
  }
  if (NODE_BUILTIN_IMPORT.test(source)) {
    throw new Error("The Vite bundle imports a node: module.");
  }
}

/**
 * Packs one package and extracts it into the consumer's node_modules.
 *
 * The tarball is the only copy the consumer can import. Workspace links are
 * not added beside it.
 *
 * @param {string} packageDirectory Package directory under `packages`.
 */
async function installPackedPackage(packageDirectory) {
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

/**
 * Writes the smallest Vite app that imports the packed browser client.
 */
async function writeConsumerApp() {
  await writeFile(
    path.join(consumerRoot, "package.json"),
    `${JSON.stringify({ name: "mconet-vite-consumer", private: true, type: "module" }, null, 2)}\n`,
  );
  await writeFile(
    path.join(consumerRoot, "index.html"),
    `<!doctype html>
<html lang="en">
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`,
  );
  await mkdir(path.join(consumerRoot, "src"), { recursive: true });
  // Reading the function name keeps the browser entry in the bundle.
  await writeFile(
    path.join(consumerRoot, "src", "main.js"),
    `import { createDefaultClient } from "@evolutos/mconet-client";

document.querySelector("#app").textContent = createDefaultClient.name;
`,
  );
}

/**
 * Builds the temporary Vite app and checks the emitted browser bundle.
 */
async function checkViteConsumer() {
  await rm(consumerRoot, { recursive: true, force: true });
  await mkdir(consumerRoot, { recursive: true });

  const packageDirectories = (await readdir(packagesRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const packageDirectory of packageDirectories) {
    await installPackedPackage(packageDirectory);
  }

  await writeConsumerApp();
  // Keep names readable. The config file is omitted so this consumer does not
  // import the bundler as an application dependency.
  await execFileAsync(viteBin, ["build", "--minify", "false"], {
    cwd: consumerRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });

  const assetRoot = path.join(consumerRoot, "dist", "assets");
  const assets = (await readdir(assetRoot)).filter((name) => name.endsWith(".js"));
  if (assets.length === 0) {
    throw new Error("The Vite consumer did not emit a JavaScript bundle.");
  }

  const bundle = (
    await Promise.all(assets.map((name) => readFile(path.join(assetRoot, name), "utf8")))
  ).join("\n");
  assertBrowserBundle(bundle);
  process.stdout.write("Vite consumer bundle uses the packed browser client.\n");
}

/**
 * Proves the bundle scanner accepts the browser entry and rejects Node code.
 */
function selfTest() {
  assertBrowserBundle("function createDefaultClient() { return new BrowserFetchTransport(); }");

  const rejectedSources = [
    "function createDefaultClient() { return 1; }",
    "function createDefaultClient() { return new BrowserFetchTransport(); } import 'node:fs'",
    "function createDefaultClient() { return new BrowserFetchTransport(); } NodeFetchTransport",
  ];
  for (const source of rejectedSources) {
    let rejected = false;
    try {
      assertBrowserBundle(source);
    } catch (error) {
      rejected = error instanceof Error;
    }
    if (!rejected) {
      throw new Error("Vite consumer self-test accepted a bundle that is not browser-only.");
    }
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/check-vite-consumer.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTest();
} else {
  await checkViteConsumer();
}
