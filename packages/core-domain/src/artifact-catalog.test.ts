// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ArtifactCatalog } from "./artifact-catalog.js";
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
