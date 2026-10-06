// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ArtifactKind } from "./artifact-kind.js";
import type { Extensions } from "./extensions.js";
import type { OpenIdentifier } from "./open-identifier.js";

/** Standard Artifact kind identities defined by the language-neutral architecture. */
const standardArtifactKindIds = [
  "artifact.text",
  "artifact.json",
  "artifact.image",
  "artifact.audio",
  "artifact.video",
  "artifact.file",
  "artifact.vector",
  "artifact.tensor",
  "artifact.archive",
  "artifact.provider_resource",
  "artifact.unknown",
] as const;

it("defines only the immutable open Artifact kind shape", () => {
  // Exact equality prevents source data, descriptors, bytes, media type, I/O
  // behavior, or runtime components from entering this identity abstraction.
  expectTypeOf<ArtifactKind>().toEqualTypeOf<{
    readonly id: OpenIdentifier;
    readonly semantic?: string;
    readonly extensions: Extensions;
  }>();
});

it("expresses every standard Artifact kind as ordinary open data", () => {
  const kinds = standardArtifactKindIds.map((id): ArtifactKind => ({
    // Wrap each standard identity in the same open interface without attaching
    // runtime support, source selection, or media handling behavior.
    id,
    extensions: {},
  }));

  // Preserve the exact reviewed vocabulary and order for later fixtures while
  // keeping standard values structurally identical to integration-defined ones.
  expect(kinds.map(({ id }) => id)).toEqual(standardArtifactKindIds);
});

it("preserves an integration-defined identity semantic and extensions", () => {
  const kind: ArtifactKind = {
    id: "provider.design_asset",
    semantic: "image",
    extensions: {
      "provider.artifact": {
        renderable: false,
        priority: 0,
      },
    },
  };

  // Identity, normalized meaning, false, and zero remain independent data and
  // are not coerced to a standard kind or used to infer Artifact support.
  expect(kind).toEqual({
    id: "provider.design_asset",
    semantic: "image",
    extensions: {
      "provider.artifact": {
        renderable: false,
        priority: 0,
      },
    },
  });
});

it("allows semantic meaning to be truly absent", () => {
  const kind: ArtifactKind = {
    id: "artifact.unknown",
    extensions: {},
  };

  // True absence avoids an empty-string sentinel and lets a boundary preserve
  // an unknown identity without claiming normalized meaning it does not know.
  expect(Object.hasOwn(kind, "semantic")).toBe(false);
});

it("requires identity and extensions at compile time", () => {
  // Neither optional semantics nor implicit defaults can replace the two fields
  // required to preserve open identity and namespaced forward-compatible data.
  expectTypeOf<{
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<ArtifactKind>();
  expectTypeOf<{
    readonly id: OpenIdentifier;
  }>().not.toMatchTypeOf<ArtifactKind>();
});

it("prevents kind and extension replacement at compile time", () => {
  const proveReadonly = (kind: ArtifactKind): void => {
    // Exercise every representative forbidden write during compilation; this
    // helper remains reachable below but is never invoked at runtime.
    // @ts-expect-error Artifact kind identity cannot be replaced.
    kind.id = "artifact.image";
    // @ts-expect-error Normalized meaning cannot be replaced.
    kind.semantic = "image";
    // @ts-expect-error Extension container cannot be replaced.
    kind.extensions = {};
    // @ts-expect-error Individual extension entries remain readonly.
    kind.extensions["provider.artifact"] = null;
  };

  // Retaining the helper ensures strict TypeScript checking verifies readonly
  // behavior without executing mutations against a runtime fixture.
  expectTypeOf(proveReadonly).toBeFunction();
});
