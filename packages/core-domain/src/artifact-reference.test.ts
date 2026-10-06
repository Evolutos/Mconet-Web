// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ArtifactMetadata } from "./artifact-metadata.js";
import type { ArtifactReference } from "./artifact-reference.js";
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
