// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type { CompatibilityPolicy } from "@evolutos/mconet-core-domain";

import { mapTemperatureToWire } from "./map-temperature.js";

const strict: CompatibilityPolicy = { mode: "strict" };
const compatible: CompatibilityPolicy = { mode: "compatible" };
const permissive: CompatibilityPolicy = { mode: "permissive" };

it("omits an absent temperature and sends zero and in-range values exactly", () => {
  const omitted = mapTemperatureToWire(undefined, strict);
  expect(omitted.diagnostics).toEqual([]);
  expect(omitted.value).toEqual({});
  expect(Object.hasOwn(omitted.value as object, "temperature")).toBe(false);

  expect(mapTemperatureToWire(0, compatible).value).toEqual({ temperature: 0 });
  expect(mapTemperatureToWire(0.7, strict).value).toEqual({ temperature: 0.7 });
  expect(mapTemperatureToWire(2, permissive).value).toEqual({ temperature: 2 });
});

it("rejects an out-of-range temperature in strict mode without clamping", () => {
  const mapped = mapTemperatureToWire(2.1, strict);

  expect(mapped.value).toBeUndefined();
  expect(mapped.diagnostics).toEqual([
    {
      code: "temperature_out_of_range",
      severity: "error",
      phase: "planning",
      message: "Temperature is outside the chat completions range and was not rewritten.",
      path: "temperature",
    },
  ]);
});

it("omits an out-of-range temperature with a warning in compatible and permissive modes", () => {
  for (const policy of [compatible, permissive]) {
    const mapped = mapTemperatureToWire(3, policy);

    expect(mapped.value).toEqual({});
    expect(Object.hasOwn(mapped.value as object, "temperature")).toBe(false);
    expect(mapped.diagnostics[0]?.severity).toBe("warning");
    expect(mapped.diagnostics[0]?.code).toBe("temperature_out_of_range");
  }
});

it("does not send a non-finite temperature", () => {
  expect(mapTemperatureToWire(Number.NaN, strict).value).toBeUndefined();
  expect(mapTemperatureToWire(Number.POSITIVE_INFINITY, compatible).value).toEqual({});
});
