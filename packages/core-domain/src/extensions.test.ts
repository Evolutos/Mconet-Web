// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";

describe("Extensions", () => {
  it("maps string keys to JSON values", () => {
    const extensions: Extensions = {
      "example.flags": {
        enabled: true,
        labels: ["stable", "browser"],
      },
    };

    expectTypeOf<Extensions>().toEqualTypeOf<Readonly<Record<string, JsonValue>>>();
    expect(extensions["example.flags"]).toEqual({
      enabled: true,
      labels: ["stable", "browser"],
    });
  });

  it("rejects index writes at compile time", () => {
    const proveReadonly = (extensions: Extensions): void => {
      // @ts-expect-error Extensions intentionally prohibits index assignment.
      extensions["example.mutable"] = false;
    };

    expectTypeOf(proveReadonly).toBeFunction();
  });

  it("rejects non-JSON extension values", () => {
    expectTypeOf<Record<string, undefined>>().not.toMatchTypeOf<Extensions>();
    expectTypeOf<Record<string, bigint>>().not.toMatchTypeOf<Extensions>();
    expectTypeOf<Record<string, () => void>>().not.toMatchTypeOf<Extensions>();
  });
});
