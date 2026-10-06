// Copyright © 2026 Mcont.

import { describe, expectTypeOf, it } from "vitest";

import type { JsonValue } from "./json-value.js";

describe("JsonValue", () => {
  it("accepts recursive primitives, arrays, and objects", () => {
    expectTypeOf<string>().toMatchTypeOf<JsonValue>();
    expectTypeOf<readonly JsonValue[]>().toMatchTypeOf<JsonValue>();
    expectTypeOf<{ readonly enabled: boolean }>().toMatchTypeOf<JsonValue>();
    expectTypeOf<{
      readonly request: {
        readonly messages: readonly [{ readonly role: "user"; readonly content: "hello" }];
        readonly temperature: 0.5;
        readonly metadata: null;
      };
    }>().toMatchTypeOf<JsonValue>();
  });

  it("rejects values outside the JSON data model", () => {
    expectTypeOf<undefined>().not.toMatchTypeOf<JsonValue>();
    expectTypeOf<bigint>().not.toMatchTypeOf<JsonValue>();
    expectTypeOf<symbol>().not.toMatchTypeOf<JsonValue>();
    expectTypeOf<() => void>().not.toMatchTypeOf<JsonValue>();
    expectTypeOf<Date>().not.toMatchTypeOf<JsonValue>();
    expectTypeOf<Map<string, JsonValue>>().not.toMatchTypeOf<JsonValue>();
  });
});
