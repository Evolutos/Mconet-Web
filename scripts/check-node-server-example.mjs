// Copyright © 2026 Mcont.

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Server example whose credential must stay in the environment. */
const exampleRoot = path.join(workspaceRoot, "examples", "node-server");

/**
 * Rejects a Node example that embeds a vendor secret or ships a browser page.
 */
async function checkNodeServerExample() {
  const source = await readFile(path.join(exampleRoot, "src", "server.ts"), "utf8");
  if (!source.includes('process.env["VENDOR_API_KEY"]')) {
    throw new Error("The Node example must read the vendor credential from the environment.");
  }
  if (source.includes("sk-") || source.includes("index.html")) {
    throw new Error("The Node example must not embed a secret or a browser page.");
  }
  if (!source.includes("response.end('{\"ok\":true}')")) {
    throw new Error("The Node example response must not carry the credential.");
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/check-node-server-example.mjs [--self-test]");
}

await checkNodeServerExample();
