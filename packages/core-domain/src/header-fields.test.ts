// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { HeaderField } from "./header-field.js";
import type { HeaderFields } from "./header-fields.js";

it("defines an ordered readonly sequence of HeaderField values", () => {
  // Exact equality prevents a string record, mutable array, wrapper object, or
  // transport-specific Headers instance from replacing the public collection.
  expectTypeOf<HeaderFields>().toEqualTypeOf<readonly HeaderField[]>();
});

it("preserves caller order and repeated normalized names", () => {
  const fields: HeaderFields = [
    { name: "x-feature", value: "alpha" },
    { name: "x-trace", value: "trace-a" },
    { name: "x-feature", value: "beta" },
  ];

  // Positional reads prove the collection neither overwrites a repeated name
  // nor groups or joins values behind the caller's declared ordering.
  expect(
    fields.map((field) => {
      // Produce a visible pair per occurrence without changing source order or
      // combining repeated names during the assertion.
      return `${field.name}:${field.value}`;
    }),
  ).toEqual(["x-feature:alpha", "x-trace:trace-a", "x-feature:beta"]);
});

it("allows an explicit empty header collection", () => {
  const fields: HeaderFields = [];

  // Empty access context is represented by a present zero-length collection,
  // leaving optionality decisions to the owning ServiceAccess contract.
  expect(fields).toHaveLength(0);
});

it("rejects lossy record and value-only array shapes", () => {
  // A record cannot preserve repeated-name positions, while a string array
  // erases each field name; neither can satisfy the collection contract.
  expectTypeOf<Readonly<Record<string, string>>>().not.toMatchTypeOf<HeaderFields>();
  expectTypeOf<readonly string[]>().not.toMatchTypeOf<HeaderFields>();
});

it("prevents collection and field mutation through the public type", () => {
  const proveReadonly = (fields: HeaderFields): void => {
    // Exercise collection growth and positional replacement only during
    // compilation; this helper is never invoked.
    // @ts-expect-error A readonly header collection cannot grow.
    fields.push({ name: "x-added", value: "value" });
    // @ts-expect-error A readonly header collection cannot replace an entry.
    fields[0] = { name: "x-replaced", value: "value" };
    for (const field of fields) {
      // Exercise nested readonly behavior on a safely narrowed element and stop
      // after the first occurrence if this compile-only helper were ever called.
      // @ts-expect-error HeaderField values remain immutable through the collection.
      field.value = "changed";
      break;
    }
  };

  // Retain the helper in the test program so every readonly expectation remains
  // checked without executing any mutation against a runtime array.
  expectTypeOf(proveReadonly).toBeFunction();
});
