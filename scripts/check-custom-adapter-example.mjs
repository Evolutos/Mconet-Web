// Copyright © 2026 Mcont.

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Example that supplies an adapter directly. */
const exampleRoot = path.join(workspaceRoot, "examples", "custom-adapter");

/**
 * Rejects a custom-adapter example that installs a resolver or patches Core.
 */
async function checkCustomAdapterExample() {
  const source = await readFile(path.join(exampleRoot, "src", "direct-adapter.ts"), "utf8");
  if (!source.includes("does not modify Core")) {
    throw new Error("The custom adapter example must stay outside Core.");
  }
  if (!source.includes("adapter: createDirectAdapter()")) {
    throw new Error("The custom adapter must be supplied directly to the client.");
  }
  if (source.includes("resolver:")) {
    throw new Error("The direct adapter path must not install an integration resolver.");
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/check-custom-adapter-example.mjs [--self-test]");
}

await checkCustomAdapterExample();
