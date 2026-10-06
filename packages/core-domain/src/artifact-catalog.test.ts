// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import { validateArtifactCatalogIds, type ArtifactCatalog } from "./artifact-catalog.js";
import type { Artifact } from "./artifact.js";

it("defines exactly one immutable Artifact collection", () => {
  // Exact equality prevents lookup maps, global scope IDs, resolver callbacks,
  // readers, uploaders, validation state, or other behavior from entering it.
  expectTypeOf<ArtifactCatalog>().toEqualTypeOf<{
    readonly artifacts: readonly Artifact[];
  }>();
});

it("represents an empty Catalog with an empty array", () => {
  const catalog: ArtifactCatalog = { artifacts: [] };

  // The always-present collection gives callers one unambiguous empty state and
  // avoids null checks, omitted-field defaults, or synthetic sentinel Artifacts.
  expect(catalog.artifacts).toEqual([]);
});

it("preserves Artifact order and object identity", () => {
  const first: Artifact = {
    id: "artifact-first",
    kind: { id: "artifact.text", extensions: {} },
    source: { kind: "provider.source.first" },
    metadata: {},
    extensions: {},
  };
  const second: Artifact = {
    id: "artifact-second",
    kind: { id: "artifact.image", extensions: {} },
    source: { kind: "provider.source.second" },
    metadata: {},
    extensions: {},
  };
  const catalog: ArtifactCatalog = { artifacts: [first, second] };

  // Representation retains caller order and references without sorting, cloning,
  // indexing, resolving source data, or inferring priority from kind values.
  expect(catalog.artifacts).toEqual([first, second]);
  expect(catalog.artifacts[0]).toBe(first);
  expect(catalog.artifacts[1]).toBe(second);
});

it("leaves duplicate identity rejection to the dedicated validator", () => {
  const first: Artifact = {
    id: "duplicate-id",
    kind: { id: "artifact.text", extensions: {} },
    source: { kind: "provider.source.first" },
    metadata: {},
    extensions: {},
  };
  const second: Artifact = {
    id: "duplicate-id",
    kind: { id: "artifact.json", extensions: {} },
    source: { kind: "provider.source.second" },
    metadata: {},
    extensions: {},
  };
  const catalog: ArtifactCatalog = { artifacts: [first, second] };

  // The data contract can represent untrusted input for later validation; it
  // does not silently discard, overwrite, or merge duplicate identities.
  expect(catalog.artifacts.map(({ id }) => id)).toEqual(["duplicate-id", "duplicate-id"]);
});

it("requires a collection and rejects null or a single Artifact", () => {
  // Empty arrays are the only empty representation; neither null nor a bare
  // Artifact can be mistaken for the Catalog's ordered collection.
  expectTypeOf<Record<never, never>>().not.toMatchTypeOf<ArtifactCatalog>();
  expectTypeOf<{ readonly artifacts: null }>().not.toMatchTypeOf<ArtifactCatalog>();
  expectTypeOf<{ readonly artifacts: Artifact }>().not.toMatchTypeOf<ArtifactCatalog>();
});

it("prevents collection replacement and mutation", () => {
  const proveReadonly = (catalog: ArtifactCatalog, artifact: Artifact): void => {
    // Exercise both forbidden writes only during compilation; this helper stays
    // reachable below but is never invoked against runtime Catalog data.
    // @ts-expect-error The Artifact collection cannot be replaced.
    catalog.artifacts = [];
    // @ts-expect-error The readonly collection cannot be mutated in place.
    catalog.artifacts.push(artifact);
  };

  // Keep the helper reachable so strict TypeScript checking verifies immutable
  // collection ownership without executing mutation or validation behavior.
  expectTypeOf(proveReadonly).toBeFunction();
});

it("accepts an empty Catalog without allocating a replacement", () => {
  const catalog: ArtifactCatalog = { artifacts: [] };

  // An empty collection is unique by definition and remains the exact value
  // supplied by the caller.
  expect(validateArtifactCatalogIds(catalog)).toEqual({
    value: catalog,
    diagnostics: [],
  });
  expect(validateArtifactCatalogIds(catalog).value).toBe(catalog);
});

it("accepts distinct IDs while preserving Catalog and Artifact identity", () => {
  const first = createCatalogArtifact("artifact-first");
  const second = createCatalogArtifact("artifact-second");
  const catalog: ArtifactCatalog = { artifacts: [first, second] };
  const result = validateArtifactCatalogIds(catalog);

  // Validation observes collection order only for conflict detection and does
  // not sort, clone, index, or replace a successful Catalog.
  expect(result.value).toBe(catalog);
  expect(result.value?.artifacts[0]).toBe(first);
  expect(result.value?.artifacts[1]).toBe(second);
  expect(result.diagnostics).toEqual([]);
});

it("returns the stable duplicate-ID diagnostic without a value", () => {
  const first = createCatalogArtifact("artifact-duplicate");
  const duplicate = createCatalogArtifact("artifact-duplicate");
  const catalog: ArtifactCatalog = { artifacts: [first, duplicate] };
  const result = validateArtifactCatalogIds(catalog);

  // A failed ProcessingResult omits value entirely and reports both conflict
  // positions as JSON-safe structured details for programmatic handling.
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

it("reports the first duplicate deterministically", () => {
  const catalog: ArtifactCatalog = {
    artifacts: [
      createCatalogArtifact("artifact-a"),
      createCatalogArtifact("artifact-b"),
      createCatalogArtifact("artifact-a"),
      createCatalogArtifact("artifact-b"),
    ],
  };

  // The earliest duplicate by collection order is stable even when another ID
  // also conflicts later in the same Catalog.
  expect(validateArtifactCatalogIds(catalog).diagnostics[0]).toMatchObject({
    code: "duplicate_artifact_id",
    path: "artifacts[2].id",
    details: {
      artifactId: "artifact-a",
      firstIndex: 0,
      duplicateIndex: 2,
    },
  });
});

it("treats case-distinct and prototype-shaped IDs as distinct strings", () => {
  const catalog: ArtifactCatalog = {
    artifacts: [
      createCatalogArtifact("artifact-a"),
      createCatalogArtifact("Artifact-a"),
      createCatalogArtifact("__proto__"),
      createCatalogArtifact("constructor"),
    ],
  };

  // Map key semantics compare strings exactly and do not inherit object-prototype
  // properties, so validation neither normalizes nor aliases caller identities.
  expect(validateArtifactCatalogIds(catalog)).toEqual({
    value: catalog,
    diagnostics: [],
  });
});

it("does not mutate the Catalog when a duplicate is found", () => {
  const first = createCatalogArtifact("artifact-same");
  const second = createCatalogArtifact("artifact-same");
  const artifacts = [first, second] as const;
  const catalog: ArtifactCatalog = { artifacts };

  validateArtifactCatalogIds(catalog);

  // Failure detection leaves collection order, references, and both original IDs
  // unchanged for logging or higher-level error handling.
  expect(catalog.artifacts).toBe(artifacts);
  expect(catalog.artifacts).toEqual([first, second]);
  expect(first.id).toBe("artifact-same");
  expect(second.id).toBe("artifact-same");
});

/** Creates one minimal data-only Artifact for Catalog identity validation tests. */
function createCatalogArtifact(id: string): Artifact {
  // A fresh value per call prevents duplicate tests from relying on repeated
  // object identity; only the supplied catalog-local string controls conflicts.
  return {
    id,
    kind: { id: "artifact.unknown", extensions: {} },
    source: { kind: "provider.source.fixture" },
    metadata: {},
    extensions: {},
  };
}
