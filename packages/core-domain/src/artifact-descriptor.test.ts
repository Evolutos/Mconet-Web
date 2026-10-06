// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ArtifactDescriptor } from "./artifact-descriptor.js";
import type { OpenIdentifier } from "./open-identifier.js";

it("defines only the immutable open descriptor-kind contract", () => {
  // Exact equality prevents dimensions, duration, bytes, source state, callbacks,
  // validators, transformers, or other modality-specific fields from the base.
  expectTypeOf<ArtifactDescriptor>().toEqualTypeOf<{
    readonly kind: OpenIdentifier;
  }>();
});

it("expresses standard-shaped and integration-defined descriptor identities", () => {
  const descriptors: readonly ArtifactDescriptor[] = [
    { kind: "artifact.descriptor.image" },
    { kind: "artifact.descriptor.audio" },
    { kind: "provider.embedding_layout" },
  ];

  // The open base preserves classification only; these values neither claim
  // runtime support nor infer modality fields from the identifier text.
  expect(descriptors.map(({ kind }) => kind)).toEqual([
    "artifact.descriptor.image",
    "artifact.descriptor.audio",
    "provider.embedding_layout",
  ]);
});

it("accepts a runtime string without closing future descriptor kinds", () => {
  const dynamicKind: string = "future.descriptor.kind";
  const descriptor: ArtifactDescriptor = { kind: dynamicKind };

  // OpenIdentifier keeps integration and future kinds representable without a
  // core-domain enum change or implicit behavior selection.
  expectTypeOf<string>().toMatchTypeOf<ArtifactDescriptor["kind"]>();
  expect(descriptor.kind).toBe(dynamicKind);
});

it("requires kind and rejects non-object descriptor representations", () => {
  // A descriptor is an extensible object with an explicit identity; bare strings
  // and unrelated property names cannot substitute for the structural contract.
  expectTypeOf<Record<never, never>>().not.toMatchTypeOf<ArtifactDescriptor>();
  expectTypeOf<string>().not.toMatchTypeOf<ArtifactDescriptor>();
  expectTypeOf<{ readonly type: OpenIdentifier }>().not.toMatchTypeOf<ArtifactDescriptor>();
});

it("prevents descriptor kind replacement at compile time", () => {
  const proveReadonly = (descriptor: ArtifactDescriptor): void => {
    // Exercise the forbidden write only during compilation; this helper remains
    // reachable below but is never invoked against a runtime fixture.
    // @ts-expect-error Artifact descriptor kind cannot be replaced.
    descriptor.kind = "artifact.descriptor.image";
  };

  // Keep the helper reachable so strict checking proves readonly behavior
  // without executing mutation or descriptor-specific logic.
  expectTypeOf(proveReadonly).toBeFunction();
});
