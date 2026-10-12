// Copyright © 2026 Mcont.

import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Directory whose JSON schemas are the frozen R1 schema set. */
const schemaDirectory = path.join(workspaceRoot, "spec", "schemas");

/** Snapshot that records the schema set and its hash. */
const snapshotPath = path.join(workspaceRoot, "spec", "r1-schema.sha256");

/**
 * Hashes the schema file names and bytes in sorted order.
 *
 * The file name is part of the hash so a rename changes the snapshot even when
 * the JSON bytes happen to match.
 *
 * @returns {Promise<{ digest: string, files: readonly string[] }>} Hash and names.
 */
async function hashSchemas() {
  const files = (await readdir(schemaDirectory)).filter((name) => name.endsWith(".json")).sort();
  const hash = createHash("sha256");
  for (const fileName of files) {
    hash.update(fileName);
    hash.update("\0");
    hash.update(await readFile(path.join(schemaDirectory, fileName)));
    hash.update("\0");
  }
  return { digest: hash.digest("hex"), files };
}

/**
 * Renders the snapshot that a later check compares exactly.
 *
 * @param {{ digest: string, files: readonly string[] }} snapshot Computed schema snapshot.
 * @returns {string} Snapshot text.
 */
function renderSnapshot(snapshot) {
  return `${snapshot.digest}\n${snapshot.files.join("\n")}\n`;
}

/**
 * Writes the schema snapshot, or rejects a snapshot that no longer matches.
 *
 * @param {boolean} checkOnly Whether to compare without writing.
 */
async function freezeSchemas(checkOnly) {
  const rendered = renderSnapshot(await hashSchemas());
  if (checkOnly) {
    const current = await readFile(snapshotPath, "utf8");
    if (current !== rendered) {
      throw new Error("The frozen R1 schema hash does not match the schema files.");
    }
    return;
  }
  await writeFile(snapshotPath, rendered);
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--check")) {
  throw new Error("Usage: node scripts/freeze-r1-schema.mjs [--check]");
}

await freezeSchemas(argument === "--check");
