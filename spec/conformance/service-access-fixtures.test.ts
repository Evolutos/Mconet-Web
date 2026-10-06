// Copyright © 2026 Mcont.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { isServiceAccess } from "../../packages/core-domain/src/service-access.js";
import { areJsonValuesCanonicallyEqual } from "../../packages/testing/src/canonical-json-comparator.js";
import { loadSchemaById } from "../schema-loader.js";
import { SchemaValidatorAdapter } from "../schema-validator-adapter.js";

/** Stable identifier of the non-sensitive ServiceAccess Schema. */
const serviceAccessSchemaId = "https://schemas.evolutos.com/mconet/access/service";

/** Module-relative directory containing only committed ServiceAccess Fixtures. */
const fixtureDirectory = fileURLToPath(new URL("../fixtures/service-access/", import.meta.url));

/** Exact filenames forming the reviewed ServiceAccess Fixture set. */
const expectedFixtureFileNames = ["complete.json", "minimal.json", "unknown-fields.json"] as const;

describe("ServiceAccess Fixtures", () => {
  // Exercise exact set membership, non-sensitive validation, authorization
  // exclusion, JSON round-trip, ordered repeated fields, and unknown retention.
  it("keeps the complete reviewed Fixture set independently parseable", async () => {
    const fixtureFileNames = await listFixtureFileNames();

    // Exact membership prevents missing access cases or unrelated JSON files
    // from silently entering the language-neutral conformance set.
    expect(fixtureFileNames).toEqual(expectedFixtureFileNames);

    // Parse every file separately so malformed JSON identifies its own source.
    for (const fixtureFileName of fixtureFileNames) {
      await expect(readFixture(fixtureFileName)).resolves.toBeDefined();
    }
  });

  it("validates every Fixture with both non-sensitive contracts", async () => {
    const schema = await loadSchemaById(serviceAccessSchemaId);
    const schemaValidator = new SchemaValidatorAdapter(schema);

    // Agreement proves endpoint policy, ordered field occurrences, optional
    // provider context, extensions, and unknown fields remain cross-language.
    for (const fixtureFileName of await listFixtureFileNames()) {
      const fixture = await readFixture(fixtureFileName);
      expect(schemaValidator.validate(fixture), fixtureFileName).toBe(true);
      expect(isServiceAccess(fixture), fixtureFileName).toBe(true);
    }
  });

  it("keeps authorization outside every ordinary Fixture", async () => {
    for (const fixtureFileName of await listFixtureFileNames()) {
      const fixture = await readFixture(fixtureFileName);

      // Fixtures are JSON objects after parsing. Check the own top-level field
      // directly so open unknown-member support cannot conceal authorization.
      expect(typeof fixture).toBe("object");
      expect(fixture).not.toBeNull();
      expect(Object.hasOwn(fixture as object, "authorization"), fixtureFileName).toBe(false);
    }
  });

  it("round-trips every Fixture with canonical JSON equivalence", async () => {
    for (const fixtureFileName of await listFixtureFileNames()) {
      const fixture = await readFixture(fixtureFileName);

      // Re-encode and parse a distinct JSON value. Canonical comparison ignores
      // object key order while preserving arrays and repeated occurrence order.
      const roundTrippedFixture = JSON.parse(JSON.stringify(fixture)) as unknown;
      expect(areJsonValuesCanonicallyEqual(fixture, roundTrippedFixture), fixtureFileName).toBe(
        true,
      );
    }
  });

  it("preserves repeated fields and unknown explicit edge values", async () => {
    const completeFixture = JSON.parse(
      JSON.stringify(await readFixture("complete.json")),
    ) as unknown;
    const unknownFixture = JSON.parse(
      JSON.stringify(await readFixture("unknown-fields.json")),
    ) as unknown;

    // Repeated header/query order is transport-significant; unknown values also
    // preserve zero, false, null, and distinct empty collection forms.
    expect(completeFixture).toMatchObject({
      headers: [
        { name: "x-feature", value: "alpha" },
        { name: "x-feature", value: "beta" },
      ],
      query: [
        { name: "Filter[Name]", value: "café & tea" },
        { name: "Filter[Name]", value: "" },
      ],
    });
    expect(unknownFixture).toMatchObject({
      futureOption: {
        attempts: 0,
        enabled: false,
        labels: [],
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
  // Preserve directory-entry types so nested directories, symlinks, and other
  // artifacts cannot become implicit inputs to this Fixture set.
  const entries = await fs.readdir(fixtureDirectory, { withFileTypes: true });

  // Relational comparison is deterministic and independent of host locale.
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort(compareFileNames);
}

/**
 * Reads and parses one constrained immediate-child Fixture file.
 *
 * @param fixtureFileName Filename returned by the reviewed directory scan.
 * @returns Parsed language-neutral JSON data without application coercion.
 */
async function readFixture(fixtureFileName: string): Promise<unknown> {
  // Joining only a scanned filename keeps reads inside the dedicated directory
  // and preserves an exact filesystem failure when a committed file is absent.
  const fixturePath = path.join(fixtureDirectory, fixtureFileName);
  const source = await fs.readFile(fixturePath, "utf8");

  // Native JSON parsing retains occurrence order and explicit empty, false,
  // zero, null, Unicode, and empty-string values without SDK normalization.
  return JSON.parse(source) as unknown;
}

/**
 * Compares filenames with deterministic UTF-16 code-unit semantics.
 *
 * @param left First filename.
 * @param right Second filename.
 * @returns Negative, zero, or positive ordering result.
 */
function compareFileNames(left: string, right: string): number {
  // Avoid locale collation so every supported host sees the same sequence.
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
