// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { QueryField } from "./query-field.js";

it("defines exactly one immutable query name and value", () => {
  // Exact equality prevents encoded URL text, collection behavior, transport
  // policy, or unrelated access metadata from entering this single occurrence.
  expectTypeOf<QueryField>().toEqualTypeOf<{
    readonly name: string;
    readonly value: string;
  }>();
});

it("retains case-sensitive pre-encoding input", () => {
  const field: QueryField = {
    name: "Filter[DisplayName]",
    value: "café & tea",
  };

  // The domain value performs no case conversion, Unicode normalization,
  // percent-encoding, plus substitution, trimming, or URL concatenation.
  expect(field.name).toBe("Filter[DisplayName]");
  expect(field.value).toBe("café & tea");
});

it("keeps repeated query names as independent occurrences", () => {
  const first: QueryField = { name: "tag", value: "alpha" };
  const second: QueryField = { name: "tag", value: "beta" };

  // Distinct objects retain both values so the later QueryFields collection can
  // preserve repetition and caller order without a lossy key-value map.
  expect([first.name, second.name]).toEqual(["tag", "tag"]);
  expect([first.value, second.value]).toEqual(["alpha", "beta"]);
});

it("requires both fields without claiming runtime validity", () => {
  // TypeScript requires the raw inputs but cannot prove endpoint-specific query
  // rules; validators and transports must still check external values.
  expectTypeOf<{ readonly name: string }>().not.toMatchTypeOf<QueryField>();
  expectTypeOf<{ readonly value: string }>().not.toMatchTypeOf<QueryField>();
  expectTypeOf<{ readonly name: string; readonly value: string }>().toMatchTypeOf<QueryField>();
});

it("prevents replacement of either query field", () => {
  const proveReadonly = (field: QueryField): void => {
    // Exercise both prohibited writes only during strict type checking; this
    // helper is never invoked and therefore cannot mutate runtime query data.
    // @ts-expect-error A query field name is immutable.
    field.name = "changed-name";
    // @ts-expect-error A query field value is immutable.
    field.value = "changed-value";
  };

  // Retain the helper in the test program so disappearing readonly errors fail
  // compilation instead of being hidden by an unused declaration.
  expectTypeOf(proveReadonly).toBeFunction();
});
