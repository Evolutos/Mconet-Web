// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ArtifactSource } from "./artifact-source.js";
import type { UriArtifactSource } from "./uri-artifact-source.js";
import type { UriValue } from "./uri-value.js";

it("defines only the fixed URI kind and UriValue reference", () => {
  // Exact equality proves the concrete source adds only its URI reference and
  // contains no authorization, bytes, path, stream, cache, or I/O behavior.
  expectTypeOf<UriArtifactSource>().toEqualTypeOf<{
    readonly kind: "artifact.source.uri";
    readonly uri: UriValue;
  }>();
  expectTypeOf<UriArtifactSource>().toMatchTypeOf<ArtifactSource>();
});

it.each([
  { kind: "absolute", value: "https://assets.example.invalid/image.png" },
  { kind: "relative", value: "../assets/image.png" },
] as const)("retains the $kind URI reference by identity", (uri) => {
  const source: UriArtifactSource = {
    kind: "artifact.source.uri",
    uri,
  };

  // Retaining the exact value object proves construction does not resolve a
  // relative reference, normalize text, allocate URL, or access the resource.
  expect(source.uri).toBe(uri);
  expect(source.uri).toEqual(uri);
});

it("keeps URI validation separate from the representation type", () => {
  const uri: UriValue = { kind: "relative", value: "./artifact" };
  const source: UriArtifactSource = { kind: "artifact.source.uri", uri };

  // The type records the already represented URI form; trust-boundary syntax
  // validation remains centralized in isUriValue rather than this interface.
  expect(source.uri.kind).toBe("relative");
  expect(source.uri.value).toBe("./artifact");
});

it("requires the exact discriminator and UriValue object", () => {
  // Inline sources, bare URI strings, and mutable platform URL objects cannot
  // substitute for the explicit portable UriValue representation.
  expectTypeOf<{
    readonly kind: "artifact.source.inline";
    readonly uri: UriValue;
  }>().not.toMatchTypeOf<UriArtifactSource>();
  expectTypeOf<{
    readonly kind: "artifact.source.uri";
    readonly uri: string;
  }>().not.toMatchTypeOf<UriArtifactSource>();
  expectTypeOf<{
    readonly kind: "artifact.source.uri";
    readonly uri: URL;
  }>().not.toMatchTypeOf<UriArtifactSource>();
});

it("prevents source field replacement at compile time", () => {
  const proveReadonly = (source: UriArtifactSource, uri: UriValue): void => {
    // Exercise forbidden writes only during compilation; this helper remains
    // reachable below but is never invoked against a runtime fixture.
    // @ts-expect-error URI source discriminator cannot be replaced.
    source.kind = "artifact.source.uri";
    // @ts-expect-error URI reference cannot be replaced.
    source.uri = uri;
  };

  // Keep the helper reachable so strict checking verifies readonly fields
  // without performing mutation or resource access.
  expectTypeOf(proveReadonly).toBeFunction();
});
