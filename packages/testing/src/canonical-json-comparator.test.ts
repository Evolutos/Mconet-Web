// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it } from "vitest";

import { areJsonValuesCanonicallyEqual } from "./index.js";

describe("areJsonValuesCanonicallyEqual", () => {
  it("treats recursively reordered object members as equal", () => {
    const left = {
      settings: { threshold: 0, enabled: true },
      name: "fixture",
      values: [null, false, { beta: 2, alpha: 1 }],
    } as const;
    const right = {
      values: [null, false, { alpha: 1, beta: 2 }],
      name: "fixture",
      settings: { enabled: true, threshold: -0 },
    } as const;

    expect(areJsonValuesCanonicallyEqual(left, right)).toBe(true);
  });

  it("preserves array order and scalar distinctions", () => {
    expect(areJsonValuesCanonicallyEqual([1, 2], [2, 1])).toBe(false);
    expect(areJsonValuesCanonicallyEqual({}, { value: null })).toBe(false);
    expect(areJsonValuesCanonicallyEqual({ value: false }, { value: 0 })).toBe(false);
    expect(areJsonValuesCanonicallyEqual({ value: [] }, { value: {} })).toBe(false);
  });

  it("handles prototype-related member names as ordinary JSON data", () => {
    const left = JSON.parse('{"constructor":{"enabled":true},"__proto__":{"value":1}}') as unknown;
    const right = JSON.parse('{"__proto__":{"value":1},"constructor":{"enabled":true}}') as unknown;

    expect(areJsonValuesCanonicallyEqual(left, right)).toBe(true);
  });

  it("does not mutate source object member order", () => {
    const left = { zebra: 1, alpha: 2 } as const;
    const right = { alpha: 2, zebra: 1 } as const;
    const leftNamesBeforeComparison = Object.keys(left);

    expect(areJsonValuesCanonicallyEqual(left, right)).toBe(true);
    expect(Object.keys(left)).toEqual(leftNamesBeforeComparison);
  });

  it("rejects runtime values that require lossy JSON coercion", () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    const sparse: unknown[] = [];
    sparse.length = 1;
    const accessorArray: unknown[] = [];
    let accessorReadCount = 0;
    Object.defineProperty(accessorArray, 0, {
      enumerable: true,
      get: () => {
        // Count any accidental getter execution so the test verifies comparison
        // remains free of input-defined behavior.
        accessorReadCount += 1;
        return "unexpected";
      },
    });
    accessorArray.length = 1;
    const accessorObject: Record<string, unknown> = {};
    let objectAccessorReadCount = 0;
    Object.defineProperty(accessorObject, "value", {
      enumerable: true,
      get: () => {
        // Count input-defined object behavior independently from the array case.
        objectAccessorReadCount += 1;
        return "unexpected";
      },
    });

    expect(() => areJsonValuesCanonicallyEqual(Number.NaN, null)).toThrow("numbers must be finite");
    expect(() => areJsonValuesCanonicallyEqual(Number.MAX_SAFE_INTEGER + 1, 0)).toThrow(
      "integers must be safe integers",
    );
    expect(() => areJsonValuesCanonicallyEqual(cyclic, {})).toThrow("cyclic reference");
    expect(() => areJsonValuesCanonicallyEqual(sparse, [])).toThrow("arrays must not be sparse");
    expect(() => areJsonValuesCanonicallyEqual(accessorArray, [])).toThrow(
      "array items must be data values",
    );
    expect(accessorReadCount).toBe(0);
    expect(() => areJsonValuesCanonicallyEqual(accessorObject, {})).toThrow(
      "object members must be data values",
    );
    expect(objectAccessorReadCount).toBe(0);
  });

  it("exposes one runtime-validating boolean comparison contract", () => {
    expectTypeOf(areJsonValuesCanonicallyEqual).toEqualTypeOf<
      (left: unknown, right: unknown) => boolean
    >();
  });
});
