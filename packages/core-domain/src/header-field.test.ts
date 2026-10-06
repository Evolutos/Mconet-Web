// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { HeaderField } from "./header-field.js";

it("defines exactly one immutable header name and value", () => {
  // Exact equality prevents authorization data, transport policy, original-name
  // state, or collection behavior from entering this single-field type.
  expectTypeOf<HeaderField>().toEqualTypeOf<{
    readonly name: string;
    readonly value: string;
  }>();
});

it("retains the normalized name and original value", () => {
  const field: HeaderField = {
    name: "x-application-context",
    value: "  tenant-a  ",
  };

  // The value object stores the already-normalized name but performs no value
  // trimming, joining, HTTP serialization, or security validation itself.
  expect(field.name).toBe("x-application-context");
  expect(field.value).toBe("  tenant-a  ");
});

it("keeps repeated names representable as independent occurrences", () => {
  const first: HeaderField = { name: "x-feature", value: "alpha" };
  const second: HeaderField = { name: "x-feature", value: "beta" };

  // Independent objects retain both values so the later ordered HeaderFields
  // collection can preserve duplicate occurrences without lossy coalescing.
  expect([first.value, second.value]).toEqual(["alpha", "beta"]);
  expect([first.name, second.name]).toEqual(["x-feature", "x-feature"]);
});

it("requires both fields without imposing runtime validity in the type", () => {
  // Runtime validity cannot be proven by TypeScript, but both raw inputs must be
  // present so the later validator can inspect them before any network action.
  expectTypeOf<{ readonly name: string }>().not.toMatchTypeOf<HeaderField>();
  expectTypeOf<{ readonly value: string }>().not.toMatchTypeOf<HeaderField>();
  expectTypeOf<{ readonly name: string; readonly value: string }>().toMatchTypeOf<HeaderField>();
});

it("prevents replacement of either field", () => {
  const proveReadonly = (field: HeaderField): void => {
    // Exercise both prohibited writes only during strict type checking; the
    // helper is never invoked and cannot mutate a runtime value.
    // @ts-expect-error A header field name is immutable.
    field.name = "changed-name";
    // @ts-expect-error A header field value is immutable.
    field.value = "changed-value";
  };

  // Retain the helper in the test program so disappearing readonly errors fail
  // compilation instead of being hidden by an unused local declaration.
  expectTypeOf(proveReadonly).toBeFunction();
});
