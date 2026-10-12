// Copyright © 2026 Mcont.

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Troubleshooting page that must mention every standard identifier. */
const troubleshootingPath = path.join(workspaceRoot, "docs", "errors", "troubleshooting.md");

/** Stable codes from the R1 error catalog, plus the client lifecycle codes. */
const standardCodes = [
  "unsupported_model_integration",
  "ambiguous_model_integration",
  "unsupported_task",
  "unsupported_message_content",
  "unsupported_interaction_mode",
  "unsupported_capability",
  "invalid_component_type_contract",
  "component_type_mismatch",
  "component_not_found",
  "ambiguous_component_selection",
  "artifact_reference_not_found",
  "duplicate_artifact_id",
  "response_body_too_large",
  "client_closed",
  "raw_response_too_large",
];

/**
 * Reads the quoted standard literals from one union type source.
 *
 * @param {string} relativePath Source file that declares the union.
 * @returns {string[]} Quoted literals in source order.
 */
async function readUnionLiterals(relativePath) {
  const source = await readFile(path.join(workspaceRoot, relativePath), "utf8");
  return [...source.matchAll(/^\s+\| "([a-z_]+)"/gmu)]
    .map((match) => match[1])
    .filter((value) => value !== undefined);
}

/**
 * Rejects a troubleshooting page that omits a standard category, phase, or code.
 */
async function checkErrorTroubleshooting() {
  const page = await readFile(troubleshootingPath, "utf8");
  const categories = await readUnionLiterals("packages/core-domain/src/error-category.ts");
  const phases = await readUnionLiterals("packages/core-domain/src/interaction-phase.ts");
  const required = [...categories, ...phases, ...standardCodes];

  if (categories.length === 0 || phases.length === 0) {
    throw new Error("Standard error unions did not yield searchable literals.");
  }

  for (const identifier of required) {
    if (!page.includes(`\`${identifier}\``)) {
      throw new Error(`The troubleshooting page does not list ${identifier}.`);
    }
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/check-error-troubleshooting.mjs [--self-test]");
}

await checkErrorTroubleshooting();
