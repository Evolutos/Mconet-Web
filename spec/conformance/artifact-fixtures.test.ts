// Copyright © 2026 Mcont.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  validateArtifactCatalogIds,
  type ArtifactCatalog,
} from "../../packages/core-domain/src/artifact-catalog.js";
import { resolveArtifactReference } from "../../packages/core-domain/src/artifact-reference.js";
import type { ArtifactReference } from "../../packages/core-domain/src/artifact-reference.js";
import { isArtifact } from "../../packages/core-domain/src/artifact.js";
import { areJsonValuesCanonicallyEqual } from "../../packages/testing/src/canonical-json-comparator.js";
import { loadSchemaById } from "../schema-loader.js";
import { SchemaValidatorAdapter } from "../schema-validator-adapter.js";

/** Stable identifier of the language-neutral Artifact Schema. */
const artifactSchemaId = "https://schemas.evolutos.com/mconet/artifact";

/** Stable identifier of the language-neutral ArtifactCatalog Schema. */
const artifactCatalogSchemaId = "https://schemas.evolutos.com/mconet/artifact/catalog";

/** Module-relative directory containing only committed Artifact Fixtures. */
const fixtureDirectory = fileURLToPath(new URL("../fixtures/artifact/", import.meta.url));

/** Exact filenames forming the reviewed Artifact Fixture set. */
const expectedFixtureFileNames = [
  "catalog.json",
  "duplicate-catalog.json",
  "references.json",
] as const;

describe("Artifact Fixtures", () => {
  // Cover exact set membership, structural/runtime agreement, open kinds,
  // reference outcomes, duplicate diagnostics, and portable JSON round trips.
  it("keeps the complete reviewed Fixture set independently parseable", async () => {
    const fixtureFileNames = await listFixtureFileNames();

    // Exact membership prevents missing semantic cases or unrelated JSON files
    // from silently changing the cross-language conformance input set.
    expect(fixtureFileNames).toEqual(expectedFixtureFileNames);

    // Parse every file separately so malformed JSON reports its precise source.
    for (const fixtureFileName of fixtureFileNames) {
      await expect(readFixture(fixtureFileName)).resolves.toBeDefined();
    }
  });

  it("validates both Catalog Fixtures and every nested Artifact", async () => {
    const artifactSchema = await loadSchemaById(artifactSchemaId);
    const catalogSchema = await loadSchemaById(artifactCatalogSchemaId);
    const artifactValidator = new SchemaValidatorAdapter(artifactSchema);
    const catalogValidator = new SchemaValidatorAdapter(catalogSchema);

    // Duplicate IDs remain structurally valid, so both Catalog files must pass
    // Schema and per-Artifact runtime contracts before semantic checks diverge.
    for (const fixtureFileName of ["catalog.json", "duplicate-catalog.json"] as const) {
      const fixture = await readFixture(fixtureFileName);
      const catalog = requireArtifactCatalog(fixture, fixtureFileName);
      expect(catalogValidator.validate(fixture), fixtureFileName).toBe(true);

      for (const artifact of catalog.artifacts) {
        // Validate each item independently to prove the Catalog Schema and
        // runtime Artifact boundary agree on its portable representation.
        expect(artifactValidator.validate(artifact), artifact.id).toBe(true);
        expect(isArtifact(artifact), artifact.id).toBe(true);
      }
    }
  });

  it("preserves ordered Artifacts and an integration-defined kind", async () => {
    const fixture = await readFixture("catalog.json");
    const catalog = requireArtifactCatalog(fixture, "catalog.json");
    const providerArtifact = requireArtifactAt(catalog, 1, "provider Artifact");
    const providerKind = requireRecord(providerArtifact.kind, "provider Artifact kind");
    const providerSource = requireRecord(providerArtifact.source, "provider Artifact source");

    // Success returns the original Catalog, proving validation neither sorts nor
    // rebuilds the committed order while unknown kind/source values stay intact.
    expect(validateArtifactCatalogIds(catalog)).toEqual({ value: catalog, diagnostics: [] });
    expect(catalog.artifacts.map(readArtifactId)).toEqual([
      "artifact-image-preview",
      "artifact-provider-vector",
    ]);
    expect(providerKind).toMatchObject({
      id: "provider.embedding_vector",
      semantic: "embedding",
      extensions: { "provider.kind": { dimensions: 3 } },
    });
    expect(providerSource).toEqual({
      kind: "provider.source.handle",
      handleId: "asset-向量-1",
      repeatable: true,
    });
  });

  it("resolves existing references and reports missing local references", async () => {
    const catalog = requireArtifactCatalog(await readFixture("catalog.json"), "catalog.json");
    const referenceFixture = requireRecord(await readFixture("references.json"), "references.json");
    const cases = requireArray(referenceFixture.cases, "reference cases");
    expect(cases).toHaveLength(2);

    // Each case carries language-neutral input and expected outcome. Resolution
    // always uses the one explicit Catalog and performs no external lookup.
    for (const [caseIndex, caseValue] of cases.entries()) {
      const fixtureCase = requireRecord(caseValue, `reference case ${caseIndex}`);
      const name = requireString(fixtureCase.name, `reference case ${caseIndex} name`);
      const reference = requireArtifactReference(
        fixtureCase.reference,
        `reference case ${caseIndex} reference`,
      );
      const expected = requireRecord(fixtureCase.expected, `reference case ${caseIndex} expected`);
      const status = requireString(expected.status, `reference case ${caseIndex} status`);
      const result = resolveArtifactReference(reference, catalog);

      if (status === "resolved") {
        // A resolved case must identify the exact existing Artifact and carry no
        // diagnostics; relation and metadata remain descriptive only.
        expect(result.value?.id, name).toBe(
          requireString(expected.artifactId, `reference case ${caseIndex} Artifact ID`),
        );
        expect(result.diagnostics, name).toEqual([]);
        continue;
      }

      // The only other reviewed status is a stable non-throwing resolution
      // error with no placeholder value or cross-Catalog fallback.
      expect(status, name).toBe("error");
      expect(Object.hasOwn(result, "value"), name).toBe(false);
      expect(result.diagnostics, name).toHaveLength(1);
      expect(result.diagnostics[0]?.code, name).toBe(
        requireString(expected.code, `reference case ${caseIndex} error code`),
      );
    }
  });

  it("reports the reviewed duplicate ID deterministically", async () => {
    const catalog = requireArtifactCatalog(
      await readFixture("duplicate-catalog.json"),
      "duplicate-catalog.json",
    );
    const result = validateArtifactCatalogIds(catalog);

    // Both items are independently valid; the second occurrence must identify
    // the first conflicting position without returning an ambiguous Catalog.
    expect(Object.hasOwn(result, "value")).toBe(false);
    expect(result.diagnostics).toEqual([
      {
        code: "duplicate_artifact_id",
        severity: "error",
        phase: "validation",
        message: "Artifact IDs must be unique within one Catalog.",
        path: "artifacts[1].id",
        details: {
          artifactId: "artifact-duplicate",
          firstIndex: 0,
          duplicateIndex: 1,
        },
      },
    ]);
  });

  it("round-trips every Fixture with canonical JSON equivalence", async () => {
    for (const fixtureFileName of await listFixtureFileNames()) {
      const fixture = await readFixture(fixtureFileName);

      // Re-encoding produces an independent portable value. Canonical comparison
      // ignores object-key order but retains Artifact, reference, and case order.
      const roundTrippedFixture = JSON.parse(JSON.stringify(fixture)) as unknown;
      expect(areJsonValuesCanonicallyEqual(fixture, roundTrippedFixture), fixtureFileName).toBe(
        true,
      );
    }
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
  // and produces a precise filesystem failure when a committed file is absent.
  const fixturePath = path.join(fixtureDirectory, fixtureFileName);
  const source = await fs.readFile(fixturePath, "utf8");

  // Native parsing preserves arrays, Unicode, unknown fields, booleans, numbers,
  // and explicit objects without inventing a runtime-specific byte carrier.
  return JSON.parse(source) as unknown;
}

/** Returns a fully runtime-validated Catalog from parsed Fixture data. */
function requireArtifactCatalog(value: unknown, context: string): ArtifactCatalog {
  const record = requireRecord(value, context);
  const artifacts = requireArray(record.artifacts, `${context} artifacts`);

  // Validate every Artifact before narrowing the complete Catalog. Catalog-wide
  // uniqueness remains intentionally separate so duplicate Fixtures can narrow.
  for (const [index, artifact] of artifacts.entries()) {
    if (!isArtifact(artifact)) {
      throw new TypeError(`Expected ${context} Artifact ${index} to be valid.`);
    }
  }
  return record as unknown as ArtifactCatalog;
}

/** Returns one Artifact at a required reviewed Catalog position. */
function requireArtifactAt(
  catalog: ArtifactCatalog,
  index: number,
  context: string,
): Record<string, unknown> {
  const artifact = catalog.artifacts[index];
  // The fixed index is part of the reviewed ordering contract, so absence is a
  // malformed Fixture rather than an optional test condition.
  if (artifact === undefined) {
    throw new TypeError(`Expected ${context} at index ${index}.`);
  }
  return artifact as unknown as Record<string, unknown>;
}

/** Extracts one Artifact ID for an exact ordered collection assertion. */
function readArtifactId(artifact: ArtifactCatalog["artifacts"][number]): string {
  // Individual Artifacts were already runtime-validated, so this accessor only
  // makes the order assertion readable and performs no coercion or normalization.
  return artifact.id;
}

/** Returns one validated ArtifactReference from a language-neutral case record. */
function requireArtifactReference(value: unknown, context: string): ArtifactReference {
  const record = requireRecord(value, context);
  const artifactId = requireString(record.artifactId, `${context} Artifact ID`);
  const metadata = requireRecord(record.metadata, `${context} metadata`);
  const relation = record.relation;

  if (relation === undefined) {
    // Preserve true optional absence instead of fabricating an undefined field.
    return { artifactId, metadata };
  }

  // A present relation is retained exactly as the resolver's descriptive input.
  return { artifactId, relation: requireString(relation, `${context} relation`), metadata };
}

/** Returns an object record or fails with the exact malformed Fixture location. */
function requireRecord(value: unknown, context: string): Record<string, unknown> {
  // Arrays are excluded because each caller expects a named JSON object whose
  // members are inspected explicitly before any domain narrowing.
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Expected ${context} to be an object.`);
  }
  return value as Record<string, unknown>;
}

/** Returns an array or fails with the exact malformed Fixture location. */
function requireArray(value: unknown, context: string): readonly unknown[] {
  // Only concrete JSON arrays have the ordering semantics under test; generic
  // iterable and array-like values are intentionally not coerced.
  if (!Array.isArray(value)) {
    throw new TypeError(`Expected ${context} to be an array.`);
  }
  return value;
}

/** Returns a string or fails with the exact malformed Fixture location. */
function requireString(value: unknown, context: string): string {
  // Preserve case and Unicode exactly because IDs and expected codes use strict
  // comparison in the production validators and resolver.
  if (typeof value !== "string") {
    throw new TypeError(`Expected ${context} to be a string.`);
  }
  return value;
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
