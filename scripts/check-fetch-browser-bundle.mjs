// Copyright © 2026 Mcont.

import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

/** Promise-based process runner used for the browser bundle build. */
const execFileAsync = promisify(execFile);

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Directory that receives the browser Fetch bundle. */
const bundleRoot = path.join(workspaceRoot, ".artifacts", "fetch-browser-bundle");

/** Node.js built-ins in both bare and explicit `node:` forms. */
const nodeBuiltinSpecifiers = new Set(
  builtinModules.flatMap((moduleName) => [moduleName, `node:${moduleName}`]),
);

/**
 * Collects Node.js built-in specifiers imported by bundled source.
 *
 * Quoted `node:` specifiers and import/require targets are checked. A type
 * annotation such as `node: TaskNode` is not an import.
 *
 * @param {string} source Bundled JavaScript source.
 * @returns {string[]} Built-in specifiers in source order.
 */
function findNodeBuiltinSpecifiers(source) {
  /** @type {string[]} */
  const specifiers = [];
  const seen = new Set();
  const patterns = [
    /(?:\bfrom|\bimport|\brequire)\s*\(?\s*["']([^"']+)["']/g,
    /["'](node:[^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier && isNodeBuiltin(specifier) && !seen.has(specifier)) {
        seen.add(specifier);
        specifiers.push(specifier);
      }
    }
  }

  return specifiers;
}

/**
 * Reports whether a module specifier is a Node.js built-in.
 *
 * @param {string} specifier Module specifier.
 * @returns {boolean} Whether the specifier is a Node.js built-in.
 */
function isNodeBuiltin(specifier) {
  return specifier.startsWith("node:") || nodeBuiltinSpecifiers.has(specifier);
}

/**
 * Builds the browser Fetch entry and rejects any Node.js built-in import.
 */
async function checkBrowserBundle() {
  const viteExecutable =
    process.platform === "win32"
      ? path.join(workspaceRoot, "node_modules", ".bin", "vite.cmd")
      : path.join(workspaceRoot, "node_modules", ".bin", "vite");

  await execFileAsync(
    viteExecutable,
    ["build", "--config", path.join(workspaceRoot, "scripts", "fetch-browser-bundle.config.mjs")],
    { cwd: workspaceRoot },
  );

  const bundleFiles = await collectJavaScriptFiles(bundleRoot);

  if (bundleFiles.length === 0) {
    throw new Error("Browser Fetch bundle did not produce a JavaScript file.");
  }

  for (const bundleFile of bundleFiles) {
    const source = await readFile(bundleFile, "utf8");
    const specifiers = findNodeBuiltinSpecifiers(source);

    if (specifiers.length > 0) {
      throw new Error(
        `Browser bundle '${path.relative(workspaceRoot, bundleFile)}' imports Node.js built-in '${specifiers[0]}'.`,
      );
    }
  }
}

/**
 * Lists JavaScript files emitted for the browser bundle.
 *
 * @param {string} directory Directory to search.
 * @returns {Promise<string[]>} Absolute JavaScript file paths.
 */
async function collectJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectJavaScriptFiles(entryPath);
      }

      return entry.name.endsWith(".js") ? [entryPath] : [];
    }),
  );

  return files.flat();
}

/**
 * Proves the scanner finds a Node.js import and ignores a type annotation.
 */
function selfTest() {
  const imported = findNodeBuiltinSpecifiers('export { readFile } from "node:fs";');
  const annotated = findNodeBuiltinSpecifiers("readonly node: TaskNode;");

  if (imported.length !== 1 || imported[0] !== "node:fs" || annotated.length !== 0) {
    throw new Error("Browser bundle scanner self-test failed.");
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/check-fetch-browser-bundle.mjs [--self-test]");
}

if (argument === "--self-test") {
  selfTest();
} else {
  await checkBrowserBundle();
}
