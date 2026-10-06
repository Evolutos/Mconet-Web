// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { FinishReason } from "./finish-reason.js";
import type { OpenIdentifier } from "./open-identifier.js";

it("is exactly one semantic alias of the open identifier contract", () => {
  // Exact equality avoids a wrapper object, closed enum, normalized semantic,
  // provider payload, output status, or runtime behavior in this atomic type.
  expectTypeOf<FinishReason>().toEqualTypeOf<OpenIdentifier>();
});

it("represents protocol reasons without declaring a universal vocabulary", () => {
  const protocolReasons = [
    "stop",
    "length",
    "content_filter",
    "tool_calls",
  ] as const satisfies readonly FinishReason[];

  // Familiar values remain ordinary protocol facts. Their presence in this test
  // does not claim that every integration supports or interprets the same set.
  expect(protocolReasons).toEqual(["stop", "length", "content_filter", "tool_calls"]);
});

it("preserves an unknown provider reason without fallback substitution", () => {
  const sourceReason = "provider.safety_review_pending";
  const dynamicReason: string = sourceReason;
  const reason: FinishReason = dynamicReason;

  // The exact producer text survives assignment; Core does not replace it with
  // `unknown`, `stop`, an OutputStatus, or an inferred cancellation reason.
  expectTypeOf<string>().toMatchTypeOf<FinishReason>();
  expect(reason).toBe(sourceReason);
  expect(reason).not.toBe("unknown");
});

it("rejects non-string finish-reason representations", () => {
  // Numeric codes, booleans, null sentinels, arrays, and objects cannot stand in
  // for the protocol's open textual identity at the public TypeScript boundary.
  expectTypeOf<number>().not.toMatchTypeOf<FinishReason>();
  expectTypeOf<boolean>().not.toMatchTypeOf<FinishReason>();
  expectTypeOf<null>().not.toMatchTypeOf<FinishReason>();
  expectTypeOf<readonly string[]>().not.toMatchTypeOf<FinishReason>();
  expectTypeOf<{ readonly reason: string }>().not.toMatchTypeOf<FinishReason>();
});
