// Copyright © 2026 Mcont.

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Example that injects a transport from outside Core. */
const exampleRoot = path.join(workspaceRoot, "examples", "custom-transport");

/**
 * Rejects a custom-transport example that patches Core instead of injecting a component.
 */
async function checkCustomTransportExample() {
  const source = await readFile(path.join(exampleRoot, "src", "counting-transport.ts"), "utf8");
  if (!source.includes("does not modify Core")) {
    throw new Error("The custom transport example must stay outside Core.");
  }
  if (!source.includes("components: { transport: createCountingTransport().transport }")) {
    throw new Error("The custom transport must be injected through the client component input.");
  }
  if (source.includes("packages/core-runtime") || source.includes("packages/core-spi")) {
    throw new Error("The custom transport example must not patch a Core package path.");
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/check-custom-transport-example.mjs [--self-test]");
}

await checkCustomTransportExample();
