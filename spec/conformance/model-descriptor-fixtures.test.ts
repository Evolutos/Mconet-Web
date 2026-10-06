// Copyright © 2026 Mcont.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { isModelDescriptor } from "../../packages/core-domain/src/model-descriptor.js";
import { areJsonValuesCanonicallyEqual } from "../../packages/testing/src/canonical-json-comparator.js";
import { loadSchemaById } from "../schema-loader.js";
import { SchemaValidatorAdapter } from "../schema-validator-adapter.js";

/** Stable identifier of the language-neutral ModelDescriptor Schema. */
const modelDescriptorSchemaId = "https://schemas.evolutos.com/mconet/model/descriptor";

/** Module-relative directory containing only committed ModelDescriptor Fixtures. */
const fixtureDirectory = fileURLToPath(new URL("../fixtures/model-descriptor/", import.meta.url));

/** Exact filenames forming the reviewed ModelDescriptor Fixture set. */
const expectedFixtureFileNames = ["complete.json", "minimal.json", "unknown-fields.json"] as const;

describe("ModelDescriptor Fixtures", () => {
  // Exercise exact set membership, both validation contracts, JSON round-trip
  // equivalence, and preservation of explicit unknown-field edge values.
  it("keeps the complete reviewed Fixture set independently parseable", async () => {
    const fixtureFileNames = await listFixtureFileNames();

    // An exact name list prevents a missing case or unrelated JSON artifact from
    // silently changing the conformance input set.
    expect(fixtureFileNames).toEqual(expectedFixtureFileNames);

    // Parse each file independently so invalid JSON reports its precise source.
    for (const fixtureFileName of fixtureFileNames) {
      await expect(readFixture(fixtureFileName)).resolves.toBeDefined();
    }
  });

  it("validates every Fixture with both Schema and runtime contracts", async () => {
    const schema = await loadSchemaById(modelDescriptorSchemaId);
    const schemaValidator = new SchemaValidatorAdapter(schema);

    // Both validators must accept the identical parsed value. This prevents a
    // language-neutral Fixture from relying on behavior unique to one boundary.
    for (const fixtureFileName of await listFixtureFileNames()) {
      const fixture = await readFixture(fixtureFileName);
      expect(schemaValidator.validate(fixture), fixtureFileName).toBe(true);
      expect(isModelDescriptor(fixture), fixtureFileName).toBe(true);
    }
  });

  it("round-trips every Fixture with canonical JSON equivalence", async () => {
    for (const fixtureFileName of await listFixtureFileNames()) {
      const fixture = await readFixture(fixtureFileName);

      // JSON text is the cross-language transport for these data-only Fixtures.
      // Reparse a fresh encoding before canonical comparison so object key order
      // cannot masquerade as a semantic mismatch.
      const roundTrippedFixture = JSON.parse(JSON.stringify(fixture)) as unknown;
      expect(areJsonValuesCanonicallyEqual(fixture, roundTrippedFixture), fixtureFileName).toBe(
        true,
      );
    }
  });

  it("preserves unknown names and explicit empty or false values", async () => {
    const fixture = await readFixture("unknown-fields.json");
    const roundTrippedFixture = JSON.parse(JSON.stringify(fixture)) as unknown;

    // Narrow only after both existing validators approve the public descriptor
    // fields; unknown members are then inspected as retained JSON data rather
    // than used for validation or runtime control flow.
    expect(isModelDescriptor(roundTrippedFixture)).toBe(true);
    expect(roundTrippedFixture).toMatchObject({
      futureOption: {
        enabled: false,
        threshold: 0,
        values: [],
        settings: {},
      },
      futureNullable: null,
    });
  });
});

/**
 * Lists regular JSON Fixture files in deterministic code-unit order.
 *
 * @returns Sorted filenames directly inside the reviewed Fixture directory.
 */
async function listFixtureFileNames(): Promise<readonly string[]> {
  // Preserve entry type data so nested directories, symlinks, and non-JSON
  // artifacts cannot become implicit conformance inputs.
  const entries = await fs.readdir(fixtureDirectory, { withFileTypes: true });

  // Explicit relational ordering is stable across locales and supported hosts.
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort(compareFileNames);
}

/**
 * Reads and parses one filename returned by the constrained directory scan.
 *
 * @param fixtureFileName Reviewed immediate-child filename.
 * @returns Parsed language-neutral JSON data without application coercion.
 */
async function readFixture(fixtureFileName: string): Promise<unknown> {
  // Joining only a scanned immediate-child name keeps reads inside the dedicated
  // Fixture directory and produces a precise filesystem failure if it vanishes.
  const fixturePath = path.join(fixtureDirectory, fixtureFileName);
  const source = await fs.readFile(fixturePath, "utf8");

  // Native parsing enforces plain JSON syntax and preserves false, zero, null,
  // empty collections, Unicode text, and array order exactly.
  return JSON.parse(source) as unknown;
}

/**
 * Compares filenames using deterministic UTF-16 code-unit ordering.
 *
 * @param left First filename.
 * @param right Second filename.
 * @returns Negative, zero, or positive ordering result.
 */
function compareFileNames(left: string, right: string): number {
  // Avoid locale collation so every implementation observes the same sequence.
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
