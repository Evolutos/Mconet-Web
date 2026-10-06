// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { CompatibilityPolicy } from "./compatibility-policy.js";
import { createDefaultCompatibilityPolicy } from "./create-default-compatibility-policy.js";

it("creates the standard compatible policy", () => {
  const policy = createDefaultCompatibilityPolicy();

  // The no-override path must resolve to the documented compatible strategy,
  // represented by the ordinary public policy contract rather than a sentinel.
  expect(policy).toEqual({ mode: "compatible" });
  expectTypeOf(policy).toEqualTypeOf<CompatibilityPolicy>();
});

it("returns a fresh policy for every invocation", () => {
  const first = createDefaultCompatibilityPolicy();
  const second = createDefaultCompatibilityPolicy();

  // Independent identities prevent an unsafe JavaScript consumer from causing
  // one interaction to observe another interaction's default object instance.
  expect(first).not.toBe(second);
  expect(first).toEqual(second);
});

it("freezes each default policy at runtime", () => {
  const policy = createDefaultCompatibilityPolicy();

  // Runtime freezing complements the TypeScript readonly field for JavaScript,
  // reflective code, and values that cross untyped application boundaries.
  expect(Object.isFrozen(policy)).toBe(true);
  // Deliberately attempt the write through reflection so the runtime assertion,
  // rather than TypeScript, verifies that the frozen object rejects mutation.
  expect(Reflect.set(policy, "mode", "permissive")).toBe(false);
  expect(policy.mode).toBe("compatible");
});

it("accepts no configuration arguments", () => {
  // The factory represents one deterministic SDK default; caller-selected modes
  // are constructed directly as CompatibilityPolicy values instead.
  expectTypeOf(createDefaultCompatibilityPolicy).parameters.toEqualTypeOf<[]>();
  expectTypeOf(createDefaultCompatibilityPolicy).returns.toEqualTypeOf<CompatibilityPolicy>();
});
