// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { TokenUsage } from "./token-usage.js";

it("defines only optional standard counts and provider extensions", () => {
  // Exact equality excludes price, latency, limits, inferred breakdowns, model
  // metadata, protocol state, and mapping behavior from token accounting.
  expectTypeOf<TokenUsage>().toEqualTypeOf<{
    readonly inputTokens?: number;
    readonly outputTokens?: number;
    readonly totalTokens?: number;
    readonly extensions: Extensions;
  }>();
});

it("preserves omitted counts without forging zero", () => {
  const usage: TokenUsage = {
    extensions: {},
  };

  // Each absent response field stays truly absent, while extensions remain a
  // concrete required preservation channel rather than an undefined sentinel.
  expect(Object.hasOwn(usage, "inputTokens")).toBe(false);
  expect(Object.hasOwn(usage, "outputTokens")).toBe(false);
  expect(Object.hasOwn(usage, "totalTokens")).toBe(false);
  expect(usage.extensions).toEqual({});
});

it("distinguishes explicit zero from omitted counts", () => {
  const usage: TokenUsage = {
    inputTokens: 0,
    totalTokens: 0,
    extensions: {},
  };

  // Zero is a concrete provider report; missing output usage remains a separate
  // fact and must not be synthesized by a later response mapper.
  expect(usage.inputTokens).toBe(0);
  expect(Object.hasOwn(usage, "outputTokens")).toBe(false);
  expect(usage.outputTokens).toBeUndefined();
  expect(usage.totalTokens).toBe(0);
});

it("preserves a provider total independently from component counts", () => {
  const usage: TokenUsage = {
    inputTokens: 11,
    outputTokens: 7,
    totalTokens: 25,
    extensions: {
      cachedInputTokens: 3,
      reasoning: {
        tokens: 4,
        estimated: false,
      },
    },
  };

  // The total may include provider categories and therefore remains 25 instead
  // of being normalized to the visible component sum of 18.
  expect(usage.totalTokens).toBe(25);
  expect(usage.totalTokens).not.toBe(11 + 7);
  expect(usage.extensions).toEqual({
    cachedInputTokens: 3,
    reasoning: { tokens: 4, estimated: false },
  });
});

it("defers numeric semantic checks without coercing values", () => {
  const unchecked: TokenUsage = {
    inputTokens: -1,
    outputTokens: 1.5,
    totalTokens: Number.POSITIVE_INFINITY,
    extensions: {},
  };

  // This interface defines transport-neutral storage shape only. A mapper or
  // validation boundary can later reject each malformed provider fact precisely.
  expect(unchecked).toEqual({
    inputTokens: -1,
    outputTokens: 1.5,
    totalTokens: Number.POSITIVE_INFINITY,
    extensions: {},
  });
});

it("prevents replacement of counts and extension entries", () => {
  const proveReadonly = (usage: TokenUsage): void => {
    // Compile invalid writes without executing this helper or mutating parsed
    // provider accounting at runtime.
    // @ts-expect-error Input count cannot be replaced.
    usage.inputTokens = 1;
    // @ts-expect-error Output count cannot be replaced.
    usage.outputTokens = 1;
    // @ts-expect-error Provider total cannot be replaced.
    usage.totalTokens = 2;
    // @ts-expect-error Provider extension entries remain readonly.
    usage.extensions.cachedInputTokens = 1;
  };

  // Retain the helper so strict TypeScript enforces every readonly constraint.
  expectTypeOf(proveReadonly).toBeFunction();
});

it("rejects alternate count and extension representations", () => {
  // Counts are JSON-number fields and extensions are a named portable JSON map,
  // not numeric text, bigint, booleans, arrays, or primitive sentinels.
  expectTypeOf<{
    readonly inputTokens: string;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<TokenUsage>();
  expectTypeOf<{
    readonly outputTokens: bigint;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<TokenUsage>();
  expectTypeOf<{
    readonly totalTokens: boolean;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<TokenUsage>();
  expectTypeOf<{
    readonly extensions: readonly [];
  }>().not.toMatchTypeOf<TokenUsage>();
});
