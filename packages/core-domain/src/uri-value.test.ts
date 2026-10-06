// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it } from "vitest";

import type { UriValue } from "./uri-value.js";

describe("UriValue", () => {
  it.each([
    { kind: "absolute", value: "https://example.invalid/models" },
    { kind: "relative", value: "../models?region=test" },
  ] as const)("preserves the $kind URI reference", (uri) => {
    const value: UriValue = uri;

    expect(value).toEqual(uri);
  });

  it("narrows absolute and relative references by kind", () => {
    const value: UriValue = { kind: "relative", value: "./messages" };

    if (value.kind === "relative") {
      expectTypeOf(value).toEqualTypeOf<{
        readonly kind: "relative";
        readonly value: string;
      }>();
    }
  });

  it("rejects mutation at compile time", () => {
    const proveReadonly = (uri: UriValue): void => {
      // @ts-expect-error UriValue is an immutable value contract.
      uri.value = "https://example.invalid/changed";
    };

    expectTypeOf(proveReadonly).toBeFunction();
  });

  it("does not accept mutable URL or ambiguous string values", () => {
    expectTypeOf<URL>().not.toMatchTypeOf<UriValue>();
    expectTypeOf<string>().not.toMatchTypeOf<UriValue>();
    expectTypeOf<{
      readonly kind: "unknown";
      readonly value: string;
    }>().not.toMatchTypeOf<UriValue>();
  });
});
