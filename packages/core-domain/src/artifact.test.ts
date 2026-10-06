// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Artifact } from "./artifact.js";
import type { ArtifactDescriptor } from "./artifact-descriptor.js";
import type { ArtifactKind } from "./artifact-kind.js";
import type { ArtifactMetadata } from "./artifact-metadata.js";
import type { ArtifactSource } from "./artifact-source.js";
import type { Extensions } from "./extensions.js";
import type { InlineArtifactSource } from "./inline-artifact-source.js";
import type { UriArtifactSource } from "./uri-artifact-source.js";

it("defines only immutable Artifact data boundaries", () => {
  // Exact equality keeps identity, classification, representation, description,
  // metadata, and extensions separate without introducing runtime behavior.
  expectTypeOf<Artifact>().toEqualTypeOf<{
    readonly id: string;
    readonly kind: ArtifactKind;
    readonly mediaType?: string;
    readonly source: ArtifactSource;
    readonly descriptor?: ArtifactDescriptor;
    readonly metadata: ArtifactMetadata;
    readonly extensions: Extensions;
  }>();
});

it("represents a minimal inline Artifact without optional fields", () => {
  const source: InlineArtifactSource = {
    kind: "artifact.source.inline",
    bytes: new Uint8Array(),
  };
  const artifact: Artifact = {
    id: "text-input",
    kind: {
      id: "artifact.text",
      extensions: {},
    },
    source,
    metadata: {},
    extensions: {},
  };

  // Optional fields remain truly absent; the base source does not pretend to
  // read bytes, and the interface does not synthesize media or descriptor data.
  expect(artifact).toEqual({
    id: "text-input",
    kind: {
      id: "artifact.text",
      extensions: {},
    },
    source,
    metadata: {},
    extensions: {},
  });
  expect(Object.hasOwn(artifact, "mediaType")).toBe(false);
  expect(Object.hasOwn(artifact, "descriptor")).toBe(false);
});

it("preserves classification source descriptor metadata and extensions independently", () => {
  const source: UriArtifactSource = {
    kind: "artifact.source.uri",
    uri: {
      kind: "relative",
      value: "assets/image-1.png",
    },
  };
  const artifact: Artifact = {
    id: "provider-image-1",
    kind: {
      id: "provider.design_asset",
      semantic: "image",
      extensions: {
        "provider.kind": { renderable: true },
      },
    },
    mediaType: "image/png",
    source,
    descriptor: {
      kind: "artifact.descriptor.image",
    },
    metadata: {
      featured: false,
      labels: ["preview", "示例"],
    },
    extensions: {
      "provider.artifact": { downloadable: false },
    },
  };

  // Structural extension fields remain attached to their own layer; the base
  // Artifact neither interprets them nor infers behavior from media type text.
  expect(artifact.kind.id).toBe("provider.design_asset");
  expect(artifact.source.kind).toBe("artifact.source.uri");
  expect(artifact.descriptor?.kind).toBe("artifact.descriptor.image");
  expect(artifact.metadata.featured).toBe(false);
  expect(artifact.extensions["provider.artifact"]).toEqual({ downloadable: false });
});

it("requires every non-optional Artifact field", () => {
  // Each missing shape proves no surrounding Catalog or source can supply an
  // implicit identity, classification, metadata, or extension container.
  expectTypeOf<{
    readonly kind: ArtifactKind;
    readonly source: ArtifactSource;
    readonly metadata: ArtifactMetadata;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<Artifact>();
  expectTypeOf<{
    readonly id: string;
    readonly source: ArtifactSource;
    readonly metadata: ArtifactMetadata;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<Artifact>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: ArtifactKind;
    readonly metadata: ArtifactMetadata;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<Artifact>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: ArtifactKind;
    readonly source: ArtifactSource;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<Artifact>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: ArtifactKind;
    readonly source: ArtifactSource;
    readonly metadata: ArtifactMetadata;
  }>().not.toMatchTypeOf<Artifact>();
});

it("keeps optional fields distinct from explicit undefined", () => {
  // exactOptionalPropertyTypes preserves true omission for wire-compatible data
  // instead of accepting present-but-undefined properties.
  expectTypeOf<{
    readonly id: string;
    readonly kind: ArtifactKind;
    readonly mediaType: undefined;
    readonly source: ArtifactSource;
    readonly descriptor: undefined;
    readonly metadata: ArtifactMetadata;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<Artifact>();
});

it("prevents Artifact fields and map entries from being replaced", () => {
  const proveReadonly = (artifact: Artifact): void => {
    // Exercise representative forbidden writes only during compilation; this
    // helper stays reachable below but is never invoked against fixture data.
    // @ts-expect-error Artifact identity cannot be replaced.
    artifact.id = "changed-artifact";
    // @ts-expect-error Artifact classification cannot be replaced.
    artifact.kind = { id: "artifact.unknown", extensions: {} };
    // @ts-expect-error Artifact source cannot be replaced.
    artifact.source = { kind: "artifact.source.inline" };
    // @ts-expect-error Artifact metadata cannot be replaced.
    artifact.metadata = {};
    // @ts-expect-error Individual metadata entries remain readonly.
    artifact.metadata.status = "changed";
    // @ts-expect-error Artifact extensions cannot be replaced.
    artifact.extensions = {};
    // @ts-expect-error Individual extension entries remain readonly.
    artifact.extensions["provider.artifact"] = null;
  };

  // Keep the helper reachable so strict TypeScript checking proves immutable
  // references without executing mutations or Artifact I/O behavior.
  expectTypeOf(proveReadonly).toBeFunction();
});
