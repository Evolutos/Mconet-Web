// Copyright © 2026 Mcont.

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Frozen R1 scope document. */
const scopePath = path.join(workspaceRoot, "spec", "r1-scope.md");

/** Identifiers the frozen scope must still name. */
const requiredIdentifiers = [
  "conversation.generate",
  "unary",
  "server_stream",
  "client_stream",
  "duplex",
  "long_running",
  "WebSocket",
  "explicit scope review",
];

/**
 * Rejects a scope document that drops a supported or rejected R1 identifier.
 */
async function checkR1Scope() {
  const scope = await readFile(scopePath, "utf8");
  for (const identifier of requiredIdentifiers) {
    if (!scope.includes(identifier)) {
      throw new Error(`The frozen R1 scope is missing ${identifier}.`);
    }
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/check-r1-scope.mjs [--self-test]");
}

await checkR1Scope();
