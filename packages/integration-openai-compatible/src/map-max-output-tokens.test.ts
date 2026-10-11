// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { mapMaxOutputTokensToWire } from "./map-max-output-tokens.js";

it("omits an absent limit and sends the smallest and largest safe limits exactly", () => {
  const omitted = mapMaxOutputTokensToWire(undefined);

  expect(omitted.diagnostics).toEqual([]);
  expect(omitted.value).toEqual({});
  expect(Object.hasOwn(omitted.value as object, "maxTokens")).toBe(false);
  expect(mapMaxOutputTokensToWire(1).value).toEqual({ maxTokens: 1 });
  expect(mapMaxOutputTokensToWire(Number.MAX_SAFE_INTEGER).value).toEqual({
    maxTokens: Number.MAX_SAFE_INTEGER,
  });
});

it("rejects boundaries that are not a positive safe integer", () => {
  const rejected = [
    0,
    -0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ];

  for (const maxOutputTokens of rejected) {
    const mapped = mapMaxOutputTokensToWire(maxOutputTokens);

    expect(mapped.value).toBeUndefined();
    expect(mapped.diagnostics[0]).toMatchObject({
      code: "max_output_tokens_out_of_range",
      severity: "error",
      phase: "planning",
      path: "maxOutputTokens",
    });
    expect(mapped.diagnostics[0]?.message).not.toContain(String(maxOutputTokens));
  }
});
