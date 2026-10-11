// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type { CompatibilityPolicy } from "@evolutos/mconet-core-domain";

import { mapTopPToWire } from "./map-top-p.js";

const strict: CompatibilityPolicy = { mode: "strict" };
const compatible: CompatibilityPolicy = { mode: "compatible" };
const permissive: CompatibilityPolicy = { mode: "permissive" };

it("omits an absent top-p and sends boundary values exactly", () => {
  const omitted = mapTopPToWire(undefined, strict);
  expect(omitted.diagnostics).toEqual([]);
  expect(Object.hasOwn(omitted.value as object, "topP")).toBe(false);

  expect(mapTopPToWire(0, compatible).value).toEqual({ topP: 0 });
  expect(mapTopPToWire(1, permissive).value).toEqual({ topP: 1 });
  expect(mapTopPToWire(0.9, strict).value).toEqual({ topP: 0.9 });
});

it("rejects an out-of-range top-p in strict mode without clamping", () => {
  const mapped = mapTopPToWire(1.1, strict);

  expect(mapped.value).toBeUndefined();
  expect(mapped.diagnostics[0]).toMatchObject({
    code: "top_p_out_of_range",
    severity: "error",
  });
});

it("omits an out-of-range top-p with a warning in compatible and permissive modes", () => {
  for (const policy of [compatible, permissive]) {
    const mapped = mapTopPToWire(1.5, policy);

    expect(mapped.value).toEqual({});
    expect(mapped.diagnostics[0]?.severity).toBe("warning");
    expect(mapped.diagnostics[0]?.code).toBe("top_p_out_of_range");
  }
});
