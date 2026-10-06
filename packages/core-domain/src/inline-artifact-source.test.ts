// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ArtifactSource } from "./artifact-source.js";
import type { Bytes } from "./bytes.js";
import type { InlineArtifactSource } from "./inline-artifact-source.js";

it("defines only the fixed inline kind and byte-view reference", () => {
  // Exact equality proves the inherited abstraction contributes only kind and
  // that URI, path, stream, authorization, metadata, and I/O remain absent.
  expectTypeOf<InlineArtifactSource>().toEqualTypeOf<{
    readonly kind: "artifact.source.inline";
    readonly bytes: Bytes;
  }>();
  expectTypeOf<InlineArtifactSource>().toMatchTypeOf<ArtifactSource>();
});

it("retains caller-owned bytes without copying or interpretation", () => {
  const bytes = new Uint8Array([0, 127, 255]);
  const source: InlineArtifactSource = {
    kind: "artifact.source.inline",
    bytes,
  };

  // Reference identity and exact values prove representation construction has
  // no hidden clone, encoding, normalization, read, upload, or conversion step.
  expect(source.bytes).toBe(bytes);
  expect([...source.bytes]).toEqual([0, 127, 255]);
});

it("represents present empty bytes without null or absence", () => {
  const source: InlineArtifactSource = {
    kind: "artifact.source.inline",
    bytes: new Uint8Array(),
  };

  // A zero-length view is still a present inline source and remains distinct
  // from a future optional source field or unsupported null sentinel.
  expect(source.bytes.byteLength).toBe(0);
  expect(Object.hasOwn(source, "bytes")).toBe(true);
});

it("requires the exact discriminator and Bytes field", () => {
  // Other source kinds and array-like numbers cannot masquerade as the concrete
  // typed-array representation required by this one source variant.
  expectTypeOf<{
    readonly kind: "artifact.source.uri";
    readonly bytes: Bytes;
  }>().not.toMatchTypeOf<InlineArtifactSource>();
  expectTypeOf<{
    readonly kind: "artifact.source.inline";
  }>().not.toMatchTypeOf<InlineArtifactSource>();
  expectTypeOf<{
    readonly kind: "artifact.source.inline";
    readonly bytes: readonly number[];
  }>().not.toMatchTypeOf<InlineArtifactSource>();
});

it("prevents source field replacement without claiming deep byte immutability", () => {
  const proveReadonly = (source: InlineArtifactSource, bytes: Bytes): void => {
    // Exercise reference-level writes only during compilation; Bytes element
    // mutability remains governed by the separate shared ownership contract.
    // @ts-expect-error Inline source discriminator cannot be replaced.
    source.kind = "artifact.source.inline";
    // @ts-expect-error The byte-view reference cannot be replaced.
    source.bytes = bytes;
  };

  // Keep the helper reachable so strict checking verifies readonly fields without
  // executing writes or misrepresenting Uint8Array as deeply immutable.
  expectTypeOf(proveReadonly).toBeFunction();
});
