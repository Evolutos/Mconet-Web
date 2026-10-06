// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { QueryField } from "./query-field.js";
import type { QueryFields } from "./query-fields.js";

it("defines an ordered readonly sequence of QueryField values", () => {
  // Exact equality prevents a string record, mutable array, wrapper object, or
  // transport-specific URLSearchParams instance from replacing the collection.
  expectTypeOf<QueryFields>().toEqualTypeOf<readonly QueryField[]>();
});

it("preserves caller order and repeated case-sensitive names", () => {
  const fields: QueryFields = [
    { name: "tag", value: "alpha" },
    { name: "Filter", value: "active" },
    { name: "tag", value: "beta" },
  ];

  // Positional reads prove the collection neither overwrites a repeated name
  // nor sorts, groups, or joins values behind the caller's declared ordering.
  expect(
    fields.map((field) => {
      // Produce a visible pair per occurrence without encoding text, changing
      // source order, or combining repeated names during the assertion.
      return `${field.name}=${field.value}`;
    }),
  ).toEqual(["tag=alpha", "Filter=active", "tag=beta"]);
});

it("allows an explicit empty query collection", () => {
  const fields: QueryFields = [];

  // A present zero-length collection represents no query occurrences, leaving
  // optionality decisions to the owning ServiceAccess contract.
  expect(fields).toHaveLength(0);
});

it("rejects lossy record and value-only array shapes", () => {
  // A record cannot preserve repeated-name positions, while a string array
  // erases each field name; neither can satisfy the collection contract.
  expectTypeOf<Readonly<Record<string, string>>>().not.toMatchTypeOf<QueryFields>();
  expectTypeOf<readonly string[]>().not.toMatchTypeOf<QueryFields>();
});

it("prevents collection and field mutation through the public type", () => {
  const proveReadonly = (fields: QueryFields): void => {
    // Exercise collection growth and positional replacement only during
    // compilation; this helper is never invoked.
    // @ts-expect-error A readonly query collection cannot grow.
    fields.push({ name: "added", value: "value" });
    // @ts-expect-error A readonly query collection cannot replace an entry.
    fields[0] = { name: "replaced", value: "value" };
    for (const field of fields) {
      // Exercise nested readonly behavior on a safely narrowed element and stop
      // after the first occurrence if this compile-only helper were ever called.
      // @ts-expect-error QueryField values remain immutable through the collection.
      field.value = "changed";
      break;
    }
  };

  // Retain the helper in the test program so every readonly expectation remains
  // checked without executing any mutation against a runtime array.
  expectTypeOf(proveReadonly).toBeFunction();
});
