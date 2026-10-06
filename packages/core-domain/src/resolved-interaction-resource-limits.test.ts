// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { InteractionResourceLimits } from "./interaction-resource-limits.js";
import type { ResolvedInteractionResourceLimits } from "./resolved-interaction-resource-limits.js";

it("requires the complete immutable byte-limit set", () => {
  // Exact equality locks the resolved result to the same three byte dimensions
  // as the input type while removing every optional-property branch.
  expectTypeOf<ResolvedInteractionResourceLimits>().toEqualTypeOf<{
    readonly maxResponseBodyBytes: number;
    readonly maxStreamingErrorBodyBytes: number;
    readonly maxFrameBytes: number;
  }>();
});

it("represents one value for every resolved limit", () => {
  const limits: ResolvedInteractionResourceLimits = {
    maxResponseBodyBytes: 16_777_216,
    maxStreamingErrorBodyBytes: 1_048_576,
    maxFrameBytes: 2_097_152,
  };

  // Preserve exact byte counts without introducing unit conversion, infinity,
  // or a missing-value sentinel into the resolved configuration snapshot.
  expect(limits).toEqual({
    maxResponseBodyBytes: 16_777_216,
    maxStreamingErrorBodyBytes: 1_048_576,
    maxFrameBytes: 2_097_152,
  });
});

it("rejects partial input-limit shapes", () => {
  // An unresolved input type may omit any field and therefore cannot satisfy a
  // result contract that guarantees finite fallback selection for every limit.
  expectTypeOf<InteractionResourceLimits>().not.toMatchTypeOf<ResolvedInteractionResourceLimits>();
  expectTypeOf<{
    readonly maxResponseBodyBytes: number;
  }>().not.toMatchTypeOf<ResolvedInteractionResourceLimits>();
  expectTypeOf<Record<never, never>>().not.toMatchTypeOf<ResolvedInteractionResourceLimits>();
});

it("keeps semantic number validation in the shared validator", () => {
  const unchecked: ResolvedInteractionResourceLimits = {
    maxResponseBodyBytes: 0,
    maxStreamingErrorBodyBytes: -1,
    maxFrameBytes: Number.POSITIVE_INFINITY,
  };

  // The interface records completeness only; the next atomic validator step
  // rejects these values with stable field-specific runtime diagnostics.
  expect(unchecked.maxResponseBodyBytes).toBe(0);
  expect(unchecked.maxStreamingErrorBodyBytes).toBe(-1);
  expect(unchecked.maxFrameBytes).toBe(Number.POSITIVE_INFINITY);
});

it("prevents replacement of resolved limits", () => {
  const proveReadonly = (limits: ResolvedInteractionResourceLimits): void => {
    // Exercise the forbidden write only during type checking; this helper is
    // never invoked and cannot mutate an execution configuration snapshot.
    // @ts-expect-error Resolved byte limits remain fixed for the interaction.
    limits.maxFrameBytes = 1;
  };

  // Retain the helper so strict TypeScript validation keeps enforcing readonly
  // fields without executing the mutation attempt.
  expectTypeOf(proveReadonly).toBeFunction();
});

it("rejects non-number resolved limit representations", () => {
  // A complete result cannot use strings, bigint values, booleans, or wrapper
  // objects as alternate byte-count representations.
  expectTypeOf<{
    readonly maxResponseBodyBytes: string;
    readonly maxStreamingErrorBodyBytes: number;
    readonly maxFrameBytes: number;
  }>().not.toMatchTypeOf<ResolvedInteractionResourceLimits>();
  expectTypeOf<{
    readonly maxResponseBodyBytes: number;
    readonly maxStreamingErrorBodyBytes: bigint;
    readonly maxFrameBytes: number;
  }>().not.toMatchTypeOf<ResolvedInteractionResourceLimits>();
  expectTypeOf<{
    readonly maxResponseBodyBytes: number;
    readonly maxStreamingErrorBodyBytes: number;
    readonly maxFrameBytes: boolean;
  }>().not.toMatchTypeOf<ResolvedInteractionResourceLimits>();
});
