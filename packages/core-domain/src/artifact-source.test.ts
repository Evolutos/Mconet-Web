// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ArtifactSource } from "./artifact-source.js";
import type { OpenIdentifier } from "./open-identifier.js";

it("defines only the immutable open source-kind contract", () => {
  // Exact equality prevents bytes, URI, path, stream, authorization, metadata,
  // callbacks, readers, resolvers, or I/O behavior from entering the base source.
  expectTypeOf<ArtifactSource>().toEqualTypeOf<{
    readonly kind: OpenIdentifier;
  }>();
});

it("expresses built-in-shaped and integration-defined source identities", () => {
  const sources: readonly ArtifactSource[] = [
    { kind: "artifact.source.inline" },
    { kind: "artifact.source.uri" },
    { kind: "provider.object_store" },
  ];

  // All identities use the same open structural contract. Their presence here
  // records no capability claim and triggers no access to the represented data.
  expect(sources.map(({ kind }) => kind)).toEqual([
    "artifact.source.inline",
    "artifact.source.uri",
    "provider.object_store",
  ]);
});

it("accepts a runtime string without closing the source vocabulary", () => {
  const dynamicKind: string = "future.source.kind";
  const source: ArtifactSource = { kind: dynamicKind };

  // Ordinary strings remain assignable through OpenIdentifier so an integration
  // can preserve a future source identity without modifying core-domain.
  expectTypeOf<string>().toMatchTypeOf<ArtifactSource["kind"]>();
  expect(source.kind).toBe(dynamicKind);
});

it("requires kind and rejects non-object source representations", () => {
  // A source is an extensible structural object whose identity field is required;
  // bare strings and unrelated wrappers cannot substitute for that contract.
  expectTypeOf<Record<never, never>>().not.toMatchTypeOf<ArtifactSource>();
  expectTypeOf<string>().not.toMatchTypeOf<ArtifactSource>();
  expectTypeOf<{ readonly type: OpenIdentifier }>().not.toMatchTypeOf<ArtifactSource>();
});

it("prevents source kind replacement at compile time", () => {
  const proveReadonly = (source: ArtifactSource): void => {
    // Exercise the forbidden write only during compilation; the helper remains
    // reachable below but is never invoked against a runtime fixture.
    // @ts-expect-error Artifact source kind cannot be replaced.
    source.kind = "artifact.source.uri";
  };

  // Keeping the helper reachable ensures strict TypeScript checking validates
  // the readonly contract without executing a mutation.
  expectTypeOf(proveReadonly).toBeFunction();
});
