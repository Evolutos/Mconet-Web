// Copyright © 2026 Mcont.

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Package whose browser condition must select the browser entry. */
const browserPackageRoot = path.join(workspaceRoot, "packages", "transport-fetch-browser");

/** Public entry selected by the browser export condition. */
const browserExportTarget = "./dist/index.js";

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
    throw new Error("Fetch browser export target must be a string or condition map.");
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

  throw new Error("Fetch browser export did not match an active condition.");
}

/**
 * Checks that the browser condition selects the browser package entry.
 */
async function checkBrowserExport() {
  const manifestPath = path.join(browserPackageRoot, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const exportsField = manifest.exports;
  const entry =
    exportsField !== null && typeof exportsField === "object" ? exportsField["."] : undefined;
  const resolved = resolveConditionalExport(entry, ["browser", "import"]);

  if (resolved.condition !== "browser" || resolved.target !== browserExportTarget) {
    throw new Error(
      `Browser condition resolved through '${resolved.condition}' to '${resolved.target}'.`,
    );
  }

  const source = await readFile(path.join(browserPackageRoot, "src", "index.ts"), "utf8");

  if (!source.includes("export { BrowserFetchTransport }")) {
    throw new Error("Browser export target does not come from the browser transport entry.");
  }
}

/**
 * Proves the resolver follows the browser key instead of a later default.
 */
function selfTest() {
  const resolved = resolveConditionalExport(
    {
      types: "./dist/index.d.ts",
      browser: "./dist/browser.js",
      default: "./dist/index.js",
    },
    ["browser", "import"],
  );

  if (resolved.condition !== "browser" || resolved.target !== "./dist/browser.js") {
    throw new Error("Fetch browser export self-test did not select the browser target.");
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/check-fetch-browser-export.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTest();
} else {
  await checkBrowserExport();
}
