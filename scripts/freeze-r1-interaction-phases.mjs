// Copyright © 2026 Mcont.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Source union that names the standard phases. */
const phaseSource = path.join(
  workspaceRoot,
  "packages",
  "core-domain",
  "src",
  "interaction-phase.ts",
);

/** Frozen phase catalog. */
const catalogPath = path.join(workspaceRoot, "spec", "r1-interaction-phases.txt");

/** Troubleshooting page that must stay aligned with the phase union. */
const troubleshootingPath = path.join(workspaceRoot, "docs", "errors", "troubleshooting.md");

/**
 * Reads the standard phase literals from the domain union.
 *
 * @returns {Promise<readonly string[]>} Phases in source order.
 */
async function readPhases() {
  const source = await readFile(phaseSource, "utf8");
  return [...source.matchAll(/^\s+\| "([a-z_]+)"/gmu)]
    .map((match) => match[1])
    .filter((value) => value !== undefined);
}

/**
 * Writes the phase catalog, or rejects a catalog that drifts from the union.
 *
 * @param {boolean} checkOnly Whether to compare without writing.
 */
async function freezePhases(checkOnly) {
  const phases = await readPhases();
  const rendered = `${phases.join("\n")}\n`;
  if (phases.length === 0) {
    throw new Error("The interaction phase union did not yield literals.");
  }
  if (!checkOnly) {
    await writeFile(catalogPath, rendered);
  } else if ((await readFile(catalogPath, "utf8")) !== rendered) {
    throw new Error("The frozen interaction phase catalog does not match the domain union.");
  }

  const troubleshooting = await readFile(troubleshootingPath, "utf8");
  for (const phase of phases) {
    if (!troubleshooting.includes(`\`${phase}\``)) {
      throw new Error(`The troubleshooting page does not list phase ${phase}.`);
    }
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--check")) {
  throw new Error("Usage: node scripts/freeze-r1-interaction-phases.mjs [--check]");
}

await freezePhases(argument === "--check");
