// Copyright © 2026 Mcont.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadSchemaById } from "../schema-loader.js";
import { SchemaValidatorAdapter } from "../schema-validator-adapter.js";

/** Stable identifier of the Schema dedicated to language-neutral base Fixtures. */
const baseTypeFixtureSchemaId = "https://schemas.evolutos.com/mconet/base/type-fixture";

/** Module-relative directory containing only committed base Fixture JSON files. */
const baseFixtureDirectory = fileURLToPath(new URL("../fixtures/base/", import.meta.url));

/** Exact Fixture filenames required by the completed base-contract set. */
const expectedFixtureFileNames = [
  "diagnostic.json",
  "duration.json",
  "error-category.json",
  "extensions.json",
  "interaction-phase.json",
  "json-primitive.json",
  "json-value.json",
  "media-type.json",
  "open-identifier.json",
  "processing-result.json",
  "recovery-hint.json",
  "timestamp.json",
  "uri-value.json",
] as const;

describe("base type Fixtures", () => {
  it("keeps the complete reviewed Fixture set independently parseable", async () => {
    // Compare exact regular-file names so an omitted base contract or an
    // unreviewed extra artifact cannot pass through a partial directory scan.
    const fixtureFileNames = await listBaseFixtureFileNames();
    expect(fixtureFileNames).toEqual(expectedFixtureFileNames);

    // Parse each file separately. A syntax failure identifies the exact Fixture
    // rather than being hidden inside one aggregate JSON document.
    for (const fixtureFileName of fixtureFileNames) {
      await expect(readBaseFixture(fixtureFileName)).resolves.toBeDefined();
    }
  });

  it("validates every committed Fixture against the base Fixture Schema", async () => {
    // Resolve the committed Schema through the production loader so this check
    // covers stable identifier lookup as well as draft 2020 validation.
    const schema = await loadSchemaById(baseTypeFixtureSchemaId);
    const validator = new SchemaValidatorAdapter(schema);

    // Validate files one by one to preserve a precise filename assertion when
    // any language-neutral representation drifts from its reviewed contract.
    for (const fixtureFileName of await listBaseFixtureFileNames()) {
      const fixture = await readBaseFixture(fixtureFileName);
      expect(validator.validate(fixture), fixtureFileName).toBe(true);
    }
  });

  it("rejects a Fixture whose discriminator does not match its case shape", async () => {
    // Compile the same committed Schema used for valid files, then deliberately
    // pair a duration discriminator with an invalid negative duration value.
    const schema = await loadSchemaById(baseTypeFixtureSchemaId);
    const validator = new SchemaValidatorAdapter(schema);
    const mismatchedFixture = {
      kind: "duration",
      cases: [{ milliseconds: -1 }],
    };

    // A false result proves the branch discriminator selects the corresponding
    // base contract instead of accepting every envelope-shaped object.
    expect(validator.validate(mismatchedFixture)).toBe(false);
  });
});

/**
 * Lists committed base Fixture files in deterministic code-unit order.
 *
 * @returns Sorted regular JSON filenames directly inside the base directory.
 */
async function listBaseFixtureFileNames(): Promise<readonly string[]> {
  // Retain directory-entry type information so nested directories, symbolic
  // links, and unrelated artifacts never become implicit Fixture inputs.
  const entries = await fs.readdir(baseFixtureDirectory, { withFileTypes: true });

  // Use explicit code-unit ordering rather than locale collation to keep the
  // same order across operating systems and language environments.
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort(compareFileNames);
}

/**
 * Reads and parses one known base Fixture without coercing its JSON values.
 *
 * @param fixtureFileName Filename returned by the constrained directory scan.
 * @returns Parsed language-neutral Fixture data.
 */
async function readBaseFixture(fixtureFileName: string): Promise<unknown> {
  // Join only a name obtained from the immediate directory scan, keeping file
  // access inside the reviewed base Fixture directory.
  const fixturePath = path.join(baseFixtureDirectory, fixtureFileName);
  const source = await fs.readFile(fixturePath, "utf8");

  // JSON.parse preserves the ordinary cross-language JSON model used by Schema
  // validation and refuses comments, executable values, or TypeScript objects.
  return JSON.parse(source) as unknown;
}

/**
 * Compares two Fixture filenames without locale-dependent collation.
 *
 * @param left First filename.
 * @param right Second filename.
 * @returns Negative, zero, or positive code-unit ordering result.
 */
function compareFileNames(left: string, right: string): number {
  // Relational string comparison has stable UTF-16 code-unit semantics across
  // the supported JavaScript runtimes and does not depend on host locale data.
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
