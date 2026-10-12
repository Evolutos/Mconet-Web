// Copyright © 2026 Mcont.

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Source union that names the standard categories. */
const categorySource = path.join(
  workspaceRoot,
  "packages",
  "core-domain",
  "src",
  "error-category.ts",
);

/** Frozen category catalog. */
const catalogPath = path.join(workspaceRoot, "spec", "r1-error-categories.txt");

/** Production packages scanned for category literals. */
const packagesRoot = path.join(workspaceRoot, "packages");

/**
 * Reads the standard category literals from the domain union.
 *
 * @returns {Promise<readonly string[]>} Categories in source order.
 */
async function readCategories() {
  const source = await readFile(categorySource, "utf8");
  return [...source.matchAll(/^\s+\| "([a-z_]+)"/gmu)]
    .map((match) => match[1])
    .filter((value) => value !== undefined);
}

/**
 * Collects TypeScript sources, skipping tests.
 *
 * @param {string} directory Directory to walk.
 * @returns {Promise<string[]>} Production source paths.
 */
async function productionSources(directory) {
  /** @type {string[]} */
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await productionSources(entryPath)));
      continue;
    }
    if (
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".spec.ts")
    ) {
      files.push(entryPath);
    }
  }
  return files;
}

/**
 * Collects category literals assigned or returned by the phase mapping.
 *
 * @param {string} source File text.
 * @returns {string[]} Category literals found in the file.
 */
function categoryLiterals(source) {
  const assigned = [...source.matchAll(/category:\s*"([a-z_]+)"/gu)].map((match) => match[1]);
  const mapping = /function categoryForPhase[\s\S]*?\n\}/u.exec(source);
  const returned = mapping
    ? [...mapping[0].matchAll(/return "([a-z_]+)"/gu)].map((match) => match[1])
    : [];
  return [...assigned, ...returned].filter((value) => value !== undefined);
}

/**
 * Writes the category catalog, or rejects an implementation value outside it.
 *
 * @param {boolean} checkOnly Whether to compare without writing.
 */
async function freezeCategories(checkOnly) {
  const categories = await readCategories();
  const rendered = `${categories.join("\n")}\n`;
  if (categories.length === 0) {
    throw new Error("The error category union did not yield literals.");
  }
  if (!checkOnly) {
    await writeFile(catalogPath, rendered);
  } else if ((await readFile(catalogPath, "utf8")) !== rendered) {
    throw new Error("The frozen error category catalog does not match the domain union.");
  }

  const allowed = new Set(categories);
  for (const filePath of await productionSources(packagesRoot)) {
    const literals = categoryLiterals(await readFile(filePath, "utf8"));
    for (const literal of literals) {
      if (!allowed.has(literal)) {
        throw new Error(`${path.relative(workspaceRoot, filePath)} uses category ${literal}.`);
      }
    }
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--check")) {
  throw new Error("Usage: node scripts/freeze-r1-error-categories.mjs [--check]");
}

await freezeCategories(argument === "--check");
