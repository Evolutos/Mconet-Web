// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { mapSeedToWire } from "./map-seed.js";

it("omits an absent seed and sends safe integers exactly", () => {
  const omitted = mapSeedToWire(undefined);

  expect(omitted.diagnostics).toEqual([]);
  expect(Object.hasOwn(omitted.value as object, "seed")).toBe(false);
  expect(mapSeedToWire(0).value).toEqual({ seed: 0 });
  expect(mapSeedToWire(-4).value).toEqual({ seed: -4 });
  expect(mapSeedToWire(Number.MAX_SAFE_INTEGER).value).toEqual({ seed: Number.MAX_SAFE_INTEGER });
  expect(mapSeedToWire(Number.MIN_SAFE_INTEGER).value).toEqual({ seed: Number.MIN_SAFE_INTEGER });
});

it("rejects an unsupported seed instead of rounding it", () => {
  const unsupported = [1.5, -0, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1];

  for (const seed of unsupported) {
    const mapped = mapSeedToWire(seed);

    expect(mapped.value).toBeUndefined();
    expect(mapped.diagnostics[0]).toMatchObject({
      code: "unsupported_seed",
      severity: "error",
      phase: "planning",
      path: "seed",
    });
    expect(mapped.diagnostics[0]?.message).toContain("not rounded");
  }
});
