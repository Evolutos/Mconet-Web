// Copyright © 2026 Mcont.

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Catalog that must repeat the implementation defaults. */
const catalogPath = path.join(workspaceRoot, "spec", "r1-defaults.md");

/** Source that freezes the compatibility mode. */
const compatibilitySource = path.join(
  workspaceRoot,
  "packages",
  "core-domain",
  "src",
  "create-default-compatibility-policy.ts",
);

/** Source that freezes the composition-root byte limits. */
const limitSource = path.join(
  workspaceRoot,
  "packages",
  "client",
  "src",
  "create-default-client.ts",
);

/**
 * Rejects a defaults catalog that disagrees with the implementation.
 */
async function checkR1Defaults() {
  const catalog = await readFile(catalogPath, "utf8");
  const compatibility = await readFile(compatibilitySource, "utf8");
  const limits = await readFile(limitSource, "utf8");

  if (!compatibility.includes('mode: "compatible"')) {
    throw new Error("The compatibility default is no longer compatible.");
  }
  if (!catalog.includes("`compatible`")) {
    throw new Error("The defaults catalog does not name the compatible mode.");
  }

  const limitNames = ["maxResponseBodyBytes", "maxStreamingErrorBodyBytes", "maxFrameBytes"];
  for (const name of limitNames) {
    const match = new RegExp(`${name}: ([0-9_]+)`).exec(limits);
    const digits = match?.[1]?.replaceAll("_", "");
    if (digits === undefined || !catalog.includes(digits)) {
      throw new Error(`The defaults catalog does not match ${name}.`);
    }
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/check-r1-defaults.mjs [--self-test]");
}

await checkR1Defaults();
