// Copyright © 2026 Mcont.

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Package whose node condition must select the Node entry. */
const nodePackageRoot = path.join(workspaceRoot, "packages", "transport-fetch-node");

/** Public entry selected by the node export condition. */
const nodeExportTarget = "./dist/index.js";

/**
 * Resolves one conditional export target using object key order.
 *
 * The first matching condition wins. `default` matches even when it is absent
 * from the active condition list, which is how Node.js resolves exports.
 *
 * @param {unknown} target Current exports value.
 * @param {readonly string[]} conditions Active export conditions.
 * @returns {{ condition: string, target: string }} Matched condition and path.
 */
function resolveConditionalExport(target, conditions) {
  if (typeof target === "string") {
    return { condition: "target", target };
  }

  if (target === null || typeof target !== "object" || Array.isArray(target)) {
    throw new Error("Fetch node export target must be a string or condition map.");
  }

  for (const [condition, value] of Object.entries(target)) {
    if (condition !== "default" && !conditions.includes(condition)) {
      continue;
    }

    const resolved = resolveConditionalExport(value, conditions);
    return {
      condition: resolved.condition === "target" ? condition : resolved.condition,
      target: resolved.target,
    };
  }

  throw new Error("Fetch node export did not match an active condition.");
}

/**
 * Checks that the node condition selects the Node package entry.
 */
async function checkNodeExport() {
  const manifestPath = path.join(nodePackageRoot, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const exportsField = manifest.exports;
  const entry =
    exportsField !== null && typeof exportsField === "object" ? exportsField["."] : undefined;
  const resolved = resolveConditionalExport(entry, ["node", "import"]);

  if (resolved.condition !== "node" || resolved.target !== nodeExportTarget) {
    throw new Error(
      `Node condition resolved through '${resolved.condition}' to '${resolved.target}'.`,
    );
  }

  const source = await readFile(path.join(nodePackageRoot, "src", "index.ts"), "utf8");

  if (!source.includes("export { NodeFetchTransport }")) {
    throw new Error("Node export target does not come from the Node transport entry.");
  }
}

/**
 * Proves the resolver follows the node key instead of a later default.
 */
function selfTest() {
  const resolved = resolveConditionalExport(
    {
      types: "./dist/index.d.ts",
      node: "./dist/node.js",
      default: "./dist/index.js",
    },
    ["node", "import"],
  );

  if (resolved.condition !== "node" || resolved.target !== "./dist/node.js") {
    throw new Error("Fetch node export self-test did not select the node target.");
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/check-fetch-node-export.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTest();
} else {
  await checkNodeExport();
}
