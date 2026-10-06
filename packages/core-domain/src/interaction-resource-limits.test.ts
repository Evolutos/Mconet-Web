// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { InteractionResourceLimits } from "./interaction-resource-limits.js";

it("defines three independent optional byte limits", () => {
  // Exact equality prevents unrelated timeouts, retry counts, or aggregate
  // limit maps from entering this per-field configuration contract.
  expectTypeOf<InteractionResourceLimits>().toEqualTypeOf<{
    readonly maxResponseBodyBytes?: number;
    readonly maxStreamingErrorBodyBytes?: number;
    readonly maxFrameBytes?: number;
  }>();
});

it("allows every limit to be omitted", () => {
  const limits: InteractionResourceLimits = {};

  // An empty layer contributes no overrides; the later resolver obtains every
  // effective value from lower-priority layers or finite SDK defaults.
  expect(limits).toEqual({});
});

it("allows each limit to be supplied independently", () => {
  const responseOnly: InteractionResourceLimits = {
    maxResponseBodyBytes: 16_777_216,
  };
  const streamingErrorOnly: InteractionResourceLimits = {
    maxStreamingErrorBodyBytes: 1_048_576,
  };
  const frameOnly: InteractionResourceLimits = {
    maxFrameBytes: 2_097_152,
  };

  // Independent objects model field-by-field precedence instead of treating a
  // partial resource-limit layer as an atomic replacement.
  expect(responseOnly).toEqual({ maxResponseBodyBytes: 16_777_216 });
  expect(streamingErrorOnly).toEqual({ maxStreamingErrorBodyBytes: 1_048_576 });
  expect(frameOnly).toEqual({ maxFrameBytes: 2_097_152 });
});

it("keeps semantic number validation in the later validator step", () => {
  const unchecked: InteractionResourceLimits = {
    maxResponseBodyBytes: 0,
    maxStreamingErrorBodyBytes: -1,
    maxFrameBytes: Number.POSITIVE_INFINITY,
  };

  // The input interface intentionally represents unvalidated numbers so one
  // dedicated runtime boundary can report stable field-specific diagnostics.
  expect(unchecked).toEqual({
    maxResponseBodyBytes: 0,
    maxStreamingErrorBodyBytes: -1,
    maxFrameBytes: Number.POSITIVE_INFINITY,
  });
});

it("prevents replacement of configured limits", () => {
  const proveReadonly = (limits: InteractionResourceLimits): void => {
    // Exercise the forbidden write only during type checking; this helper is
    // never invoked and cannot mutate a caller's runtime configuration object.
    // @ts-expect-error Resource limit inputs are immutable configuration data.
    limits.maxResponseBodyBytes = 1;
  };

  // Retain the helper so strict TypeScript validation continues enforcing the
  // readonly assignment without executing it.
  expectTypeOf(proveReadonly).toBeFunction();
});

it("rejects non-number limit representations", () => {
  // Strings, bigint values, booleans, and nested wrapper objects are not valid
  // byte-count representations at the public TypeScript boundary.
  expectTypeOf<{
    readonly maxResponseBodyBytes: string;
  }>().not.toMatchTypeOf<InteractionResourceLimits>();
  expectTypeOf<{
    readonly maxStreamingErrorBodyBytes: bigint;
  }>().not.toMatchTypeOf<InteractionResourceLimits>();
  expectTypeOf<{
    readonly maxFrameBytes: boolean;
  }>().not.toMatchTypeOf<InteractionResourceLimits>();
  expectTypeOf<{
    readonly maxFrameBytes: { readonly bytes: number };
  }>().not.toMatchTypeOf<InteractionResourceLimits>();
});
