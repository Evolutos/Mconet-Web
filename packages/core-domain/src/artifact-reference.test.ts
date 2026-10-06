// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ArtifactMetadata } from "./artifact-metadata.js";
import { resolveArtifactReference, type ArtifactReference } from "./artifact-reference.js";
import type { Artifact } from "./artifact.js";
import type { ArtifactCatalog } from "./artifact-catalog.js";
import type { OpenIdentifier } from "./open-identifier.js";

it("defines only immutable catalog-local reference data", () => {
  // Exact equality prevents embedded Artifacts, catalogs, scope identifiers,
  // resolver callbacks, readers, uploaders, or cross-request locations.
  expectTypeOf<ArtifactReference>().toEqualTypeOf<{
    readonly artifactId: string;
    readonly relation?: OpenIdentifier;
    readonly metadata: ArtifactMetadata;
  }>();
});

it("represents a reference without requiring a relation", () => {
  const reference: ArtifactReference = {
    artifactId: "image-primary",
    metadata: {},
  };

  // Omission remains distinct from a fabricated default relation; resolution
  // still depends only on the containing catalog and the preserved identity.
  expect(reference).toEqual({
    artifactId: "image-primary",
    metadata: {},
  });
  expect("relation" in reference).toBe(false);
});

it("preserves an open relation and JSON-compatible metadata", () => {
  const reference: ArtifactReference = {
    artifactId: "provider-output-1",
    relation: "provider.generated_preview",
    metadata: {
      featured: false,
      rank: 0,
      labels: ["preview", "示例"],
      crop: { mode: "fit" },
    },
  };

  // Relation and metadata are descriptive data only; the interface neither
  // interprets their semantics nor performs a catalog lookup.
  expect(reference).toEqual({
    artifactId: "provider-output-1",
    relation: "provider.generated_preview",
    metadata: {
      featured: false,
      rank: 0,
      labels: ["preview", "示例"],
      crop: { mode: "fit" },
    },
  });
});

it("requires an artifact identity and metadata at compile time", () => {
  // Both fields remain explicit because neither catalog position nor a default
  // metadata object may be inferred by this data-only contract.
  expectTypeOf<{
    readonly metadata: ArtifactMetadata;
  }>().not.toMatchTypeOf<ArtifactReference>();
  expectTypeOf<{
    readonly artifactId: string;
  }>().not.toMatchTypeOf<ArtifactReference>();
});

it("keeps an omitted relation distinct from explicit undefined", () => {
  // exactOptionalPropertyTypes prevents serialized presence from being blurred
  // with true omission at the domain boundary.
  expectTypeOf<{
    readonly artifactId: string;
    readonly relation: undefined;
    readonly metadata: ArtifactMetadata;
  }>().not.toMatchTypeOf<ArtifactReference>();
});

it("prevents reference field and metadata entry replacement", () => {
  const proveReadonly = (reference: ArtifactReference): void => {
    // Exercise each forbidden write only during compilation; this helper stays
    // reachable below but is never invoked against runtime fixture data.
    // @ts-expect-error Artifact identity cannot be replaced.
    reference.artifactId = "changed-artifact";
    // @ts-expect-error Relation cannot be replaced.
    reference.relation = "artifact.changed_relation";
    // @ts-expect-error Metadata cannot be replaced.
    reference.metadata = {};
    // @ts-expect-error Individual metadata entries remain readonly.
    reference.metadata.status = "changed";
  };

  // Keep the helper reachable so strict TypeScript checking validates every
  // forbidden assignment without executing mutation or resolution logic.
  expectTypeOf(proveReadonly).toBeFunction();
});

it("resolves the matching Artifact by identity", () => {
  const first = createReferencedArtifact("artifact-first");
  const target = createReferencedArtifact("artifact-target");
  const catalog: ArtifactCatalog = { artifacts: [first, target] };
  const reference: ArtifactReference = {
    artifactId: "artifact-target",
    metadata: {},
  };
  const result = resolveArtifactReference(reference, catalog);

  // Successful lookup returns the existing object without copying source data,
  // metadata, extensions, or the containing Catalog.
  expect(result.value).toBe(target);
  expect(result.diagnostics).toEqual([]);
});

it("uses only artifactId and leaves relation metadata descriptive", () => {
  const target = createReferencedArtifact("artifact-output");
  const catalog: ArtifactCatalog = { artifacts: [target] };
  const reference: ArtifactReference = {
    artifactId: "artifact-output",
    relation: "provider.preview_of",
    metadata: {
      preferred: false,
      rank: 0,
    },
  };

  // Relation and metadata carry caller context but neither redirects lookup nor
  // changes the resolved Artifact.
  expect(resolveArtifactReference(reference, catalog)).toEqual({
    value: target,
    diagnostics: [],
  });
  expect(reference.relation).toBe("provider.preview_of");
  expect(reference.metadata).toEqual({ preferred: false, rank: 0 });
});

it("returns the stable not-found diagnostic without a value", () => {
  const catalog: ArtifactCatalog = {
    artifacts: [createReferencedArtifact("artifact-present")],
  };
  const reference: ArtifactReference = {
    artifactId: "artifact-missing",
    metadata: {},
  };
  const result = resolveArtifactReference(reference, catalog);

  // Resolution failure identifies the reference field and missing local ID while
  // omitting value entirely instead of creating a placeholder Artifact.
  expect(Object.hasOwn(result, "value")).toBe(false);
  expect(result.diagnostics).toEqual([
    {
      code: "artifact_reference_not_found",
      severity: "error",
      phase: "resolution",
      message: "The referenced Artifact does not exist in the supplied Catalog.",
      path: "artifactId",
      details: {
        artifactId: "artifact-missing",
      },
    },
  ]);
});

it("does not search another Catalog when the local scope misses", () => {
  const localCatalog: ArtifactCatalog = { artifacts: [] };
  const otherCatalog: ArtifactCatalog = {
    artifacts: [createReferencedArtifact("artifact-external")],
  };
  const reference: ArtifactReference = {
    artifactId: "artifact-external",
    metadata: {},
  };

  // Supplying another Catalog in the same process does not create an implicit
  // registry; only the explicit local argument participates in this call.
  expect(resolveArtifactReference(reference, localCatalog).diagnostics[0]?.code).toBe(
    "artifact_reference_not_found",
  );
  expect(resolveArtifactReference(reference, otherCatalog).value).toBe(otherCatalog.artifacts[0]);
});

it("compares local IDs exactly without case normalization", () => {
  const catalog: ArtifactCatalog = {
    artifacts: [createReferencedArtifact("Artifact-Image")],
  };
  const reference: ArtifactReference = {
    artifactId: "artifact-image",
    metadata: {},
  };

  // Case-distinct strings are different Catalog identities and cannot resolve by
  // case folding, trimming, Unicode normalization, or fuzzy matching.
  expect(resolveArtifactReference(reference, catalog).diagnostics[0]?.code).toBe(
    "artifact_reference_not_found",
  );
});

it("propagates duplicate-ID validation before lookup", () => {
  const first = createReferencedArtifact("artifact-duplicate");
  const second = createReferencedArtifact("artifact-duplicate");
  const catalog: ArtifactCatalog = { artifacts: [first, second] };
  const reference: ArtifactReference = {
    artifactId: "artifact-duplicate",
    metadata: {},
  };
  const result = resolveArtifactReference(reference, catalog);

  // An ambiguous Catalog fails with the earlier validation diagnostic and never
  // resolves arbitrarily to the first matching Artifact.
  expect(Object.hasOwn(result, "value")).toBe(false);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]).toMatchObject({
    code: "duplicate_artifact_id",
    phase: "validation",
    path: "artifacts[1].id",
  });
});

it("rejects unrelated Catalog duplication before resolving a unique target", () => {
  const target = createReferencedArtifact("artifact-target");
  const catalog: ArtifactCatalog = {
    artifacts: [
      target,
      createReferencedArtifact("artifact-duplicate"),
      createReferencedArtifact("artifact-duplicate"),
    ],
  };
  const reference: ArtifactReference = {
    artifactId: "artifact-target",
    metadata: {},
  };

  // Catalog validity is a scope-wide precondition, so an unrelated duplicate
  // cannot be ignored merely because the requested ID itself is unique.
  expect(resolveArtifactReference(reference, catalog).diagnostics[0]?.code).toBe(
    "duplicate_artifact_id",
  );
});

it("does not mutate the reference Catalog or resolved Artifact", () => {
  const target = createReferencedArtifact("artifact-stable");
  const artifacts = [target] as const;
  const catalog: ArtifactCatalog = { artifacts };
  const reference: ArtifactReference = {
    artifactId: "artifact-stable",
    relation: "artifact.input",
    metadata: { original: true },
  };

  resolveArtifactReference(reference, catalog);

  // Lookup is observational: collection identity, target identity, relation, and
  // metadata remain exactly as supplied.
  expect(catalog.artifacts).toBe(artifacts);
  expect(catalog.artifacts[0]).toBe(target);
  expect(reference).toEqual({
    artifactId: "artifact-stable",
    relation: "artifact.input",
    metadata: { original: true },
  });
});

/** Creates one minimal Artifact with the requested Catalog-local identity. */
function createReferencedArtifact(id: string): Artifact {
  // Allocate a fresh object on each call so resolver tests distinguish identity
  // lookup from accidental fixture reuse or structural equality.
  return {
    id,
    kind: { id: "artifact.unknown", extensions: {} },
    source: { kind: "provider.source.fixture" },
    metadata: {},
    extensions: {},
  };
}
