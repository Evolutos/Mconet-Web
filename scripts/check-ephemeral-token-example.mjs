// Copyright © 2026 Mcont.

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Browser example that must state the direct-call premises and take a token argument. */
const exampleRoot = path.join(workspaceRoot, "examples", "browser-direct-ephemeral-token");

/**
 * Rejects a direct browser example that hides its CORS premise or embeds a token.
 */
async function checkEphemeralTokenExample() {
  const source = await readFile(path.join(exampleRoot, "src", "main.ts"), "utf8");
  const requiredPremises = [
    "Access-Control-Allow-Origin",
    "Access-Control-Allow-Headers",
    "short-lived",
    "revocable",
  ];

  for (const premise of requiredPremises) {
    if (!source.includes(premise)) {
      throw new Error(`The ephemeral-token example must state this premise: ${premise}`);
    }
  }
  if (!source.includes("ephemeralToken: string")) {
    throw new Error("The ephemeral token must be a call argument, not a module constant.");
  }
  if (source.includes("VENDOR_API_KEY") || source.includes("sk-")) {
    throw new Error("The ephemeral-token example must not embed a vendor secret.");
  }
  if (!source.includes("bearerAuthorizationKind")) {
    throw new Error("The ephemeral-token example must select the Bearer scheme.");
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/check-ephemeral-token-example.mjs [--self-test]");
}

await checkEphemeralTokenExample();
