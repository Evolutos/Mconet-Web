// Copyright © 2026 Mcont.

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Frozen code catalog. */
const catalogPath = path.join(workspaceRoot, "spec", "r1-error-codes.txt");

/** Production packages scanned for error code literals. */
const packagesRoot = path.join(workspaceRoot, "packages");

/** R1 codes that remain reserved even when one is not currently assigned. */
const reservedCodes = [
  "ambiguous_model_integration",
  "ambiguous_component_selection",
  "artifact_reference_not_found",
  "component_not_found",
  "component_type_mismatch",
  "duplicate_artifact_id",
  "invalid_component_type_contract",
  "response_body_too_large",
  "unsupported_capability",
  "unsupported_interaction_mode",
  "unsupported_message_content",
  "unsupported_model_integration",
  "unsupported_task",
];

/**
 * Collects production TypeScript sources, skipping tests.
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
 * Collects the code catalog from reserved codes and production literals.
 *
 * @returns {Promise<readonly string[]>} Sorted unique codes.
 */
async function collectCodes() {
  const codes = new Set(reservedCodes);
  for (const filePath of await productionSources(packagesRoot)) {
    const source = await readFile(filePath, "utf8");
    for (const match of source.matchAll(/\bcode:\s*"([a-z0-9_]+)"/gu)) {
      if (match[1] !== undefined) {
        codes.add(match[1]);
      }
    }
    for (const match of source.matchAll(/\bconst \w+Code = "([a-z0-9_]+)"/gu)) {
      if (match[1] !== undefined) {
        codes.add(match[1]);
      }
    }
  }
  return [...codes].sort();
}

/**
 * Writes the code catalog, or rejects a catalog that has drifted.
 *
 * @param {boolean} checkOnly Whether to compare without writing.
 */
async function freezeCodes(checkOnly) {
  const rendered = `${(await collectCodes()).join("\n")}\n`;
  if (!checkOnly) {
    await writeFile(catalogPath, rendered);
    return;
  }
  if ((await readFile(catalogPath, "utf8")) !== rendered) {
    throw new Error("The frozen error code catalog does not match the implementation.");
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--check")) {
  throw new Error("Usage: node scripts/freeze-r1-error-codes.mjs [--check]");
}

await freezeCodes(argument === "--check");
