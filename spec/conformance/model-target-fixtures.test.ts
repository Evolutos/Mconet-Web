// Copyright © 2026 Mcont.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { isModelTarget } from "../../packages/core-domain/src/model-target.js";
import { areJsonValuesCanonicallyEqual } from "../../packages/testing/src/canonical-json-comparator.js";
import { loadSchemaById } from "../schema-loader.js";
import { SchemaValidatorAdapter } from "../schema-validator-adapter.js";

/** Stable identifier of the language-neutral ModelTarget Schema. */
const modelTargetSchemaId = "https://schemas.evolutos.com/mconet/model/target";

/** Module-relative directory containing only committed ModelTarget Fixtures. */
const fixtureDirectory = fileURLToPath(new URL("../fixtures/model-target/", import.meta.url));

/** Exact filenames forming the reviewed ModelTarget Fixture set. */
const expectedFixtureFileNames = ["complete.json", "minimal.json", "unknown-fields.json"] as const;

describe("ModelTarget Fixtures", () => {
  // Exercise exact set membership, both validation contracts, JSON round-trip,
  // and unknown-field preservation at target and embedded model boundaries.
  it("keeps the complete reviewed Fixture set independently parseable", async () => {
    const fixtureFileNames = await listFixtureFileNames();

    // Exact membership prevents an omitted identity case or unrelated artifact
    // from silently changing the cross-language conformance inputs.
    expect(fixtureFileNames).toEqual(expectedFixtureFileNames);

    // Parse each file independently so malformed JSON identifies its own path.
    for (const fixtureFileName of fixtureFileNames) {
      await expect(readFixture(fixtureFileName)).resolves.toBeDefined();
    }
  });

  it("validates every Fixture with both Schema and runtime contracts", async () => {
    const schema = await loadSchemaById(modelTargetSchemaId);
    const schemaValidator = new SchemaValidatorAdapter(schema);

    // Both validators receive the same parsed value so neither target identity
    // nor its nested model can depend on a language-specific interpretation.
    for (const fixtureFileName of await listFixtureFileNames()) {
      const fixture = await readFixture(fixtureFileName);
      expect(schemaValidator.validate(fixture), fixtureFileName).toBe(true);
      expect(isModelTarget(fixture), fixtureFileName).toBe(true);
    }
  });

  it("round-trips every Fixture with canonical JSON equivalence", async () => {
    for (const fixtureFileName of await listFixtureFileNames()) {
      const fixture = await readFixture(fixtureFileName);

      // Encode and parse a distinct value before canonical comparison. Object
      // key order may change, while nested array order and JSON values must not.
      const roundTrippedFixture = JSON.parse(JSON.stringify(fixture)) as unknown;
      expect(areJsonValuesCanonicallyEqual(fixture, roundTrippedFixture), fixtureFileName).toBe(
        true,
      );
    }
  });

  it("preserves unknown target and model fields with explicit edge values", async () => {
    const fixture = await readFixture("unknown-fields.json");
    const roundTrippedFixture = JSON.parse(JSON.stringify(fixture)) as unknown;

    // Validate known target structure first, then assert both retention points
    // without allowing unknown data to influence protocol or service identity.
    expect(isModelTarget(roundTrippedFixture)).toBe(true);
    expect(roundTrippedFixture).toMatchObject({
      serviceId: "future.service",
      protocolId: "future.protocol",
      model: {
        futureModelOption: {
          enabled: false,
          values: [],
        },
      },
      futureTargetOption: {
        threshold: 0,
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
  // Retain entry types so directories, symlinks, and non-JSON files cannot
  // become implicit members of the committed Fixture set.
  const entries = await fs.readdir(fixtureDirectory, { withFileTypes: true });

  // Relational string ordering avoids locale-dependent filename sequences.
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
  // Join only a scanned immediate-child name to keep reads inside the dedicated
  // directory and preserve a precise filesystem error if a file disappears.
  const fixturePath = path.join(fixtureDirectory, fixtureFileName);
  const source = await fs.readFile(fixturePath, "utf8");

  // Native JSON parsing rejects comments and executable values while retaining
  // Unicode, false, zero, null, empty collections, and array order.
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
  // Keep ordering independent from operating-system locale configuration.
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
