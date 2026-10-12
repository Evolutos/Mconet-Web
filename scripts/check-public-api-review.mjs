// Copyright © 2026 Mcont.

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Review record that must name every accepted package. */
const reviewPath = path.join(workspaceRoot, "docs", "api", "public-api-review.md");

/** Packages accepted by the current public API review. */
const acceptedPackages = [
  "auth-basic",
  "client",
  "codec-json",
  "core-domain",
  "core-runtime",
  "core-spi",
  "integration-openai-compatible",
  "testing",
  "transport-fetch-browser",
  "transport-fetch-node",
  "transport-fetch-shared",
];

/**
 * Rejects a review record that omits an accepted package.
 */
async function checkPublicApiReview() {
  const review = await readFile(reviewPath, "utf8");
  for (const packageName of acceptedPackages) {
    if (!review.includes(`\`${packageName}\``)) {
      throw new Error(`The public API review does not accept ${packageName}.`);
    }
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/check-public-api-review.mjs [--self-test]");
}

await checkPublicApiReview();
