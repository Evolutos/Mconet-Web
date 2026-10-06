// Copyright © 2026 Mcont.

import { describe, expectTypeOf, it } from "vitest";

import type { JsonPrimitive } from "./json-primitive.js";

describe("JsonPrimitive", () => {
  it("accepts exactly the JSON primitive TypeScript shapes", () => {
    expectTypeOf<string>().toMatchTypeOf<JsonPrimitive>();
    expectTypeOf<number>().toMatchTypeOf<JsonPrimitive>();
    expectTypeOf<boolean>().toMatchTypeOf<JsonPrimitive>();
    expectTypeOf<null>().toMatchTypeOf<JsonPrimitive>();

    expectTypeOf<undefined>().not.toMatchTypeOf<JsonPrimitive>();
    expectTypeOf<bigint>().not.toMatchTypeOf<JsonPrimitive>();
    expectTypeOf<symbol>().not.toMatchTypeOf<JsonPrimitive>();
    expectTypeOf<readonly unknown[]>().not.toMatchTypeOf<JsonPrimitive>();
    expectTypeOf<Record<string, unknown>>().not.toMatchTypeOf<JsonPrimitive>();
  });
});
