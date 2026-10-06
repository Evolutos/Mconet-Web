// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it } from "vitest";

import { isUriValue, type UriValue } from "./uri-value.js";

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

  describe("isUriValue", () => {
    it.each([
      { kind: "absolute", value: "https://example.invalid/models?x=1#result" },
      { kind: "absolute", value: "urn:example:model%20name" },
      { kind: "absolute", value: "mailto:user@example.invalid" },
      { kind: "relative", value: "" },
      { kind: "relative", value: "../models?x=1#result" },
      { kind: "relative", value: "//example.invalid/models" },
      { kind: "relative", value: "?query=value" },
      { kind: "relative", value: "#fragment" },
    ])("accepts $kind reference $value", (value) => {
      expect(isUriValue(value)).toBe(true);
    });

    it.each([
      undefined,
      null,
      "https://example.invalid",
      [],
      {},
      { kind: "unknown", value: "models" },
      { kind: "absolute", value: "../models" },
      { kind: "relative", value: "https://example.invalid/models" },
      { kind: "absolute", value: "1https://example.invalid" },
      { kind: "relative", value: "first:segment/path" },
      { kind: "relative", value: "models with spaces" },
      { kind: "relative", value: "models\0invalid" },
      { kind: "relative", value: "模型" },
      { kind: "relative", value: "models\\windows" },
      { kind: "relative", value: "models%" },
      { kind: "relative", value: "models%2" },
      { kind: "relative", value: "models%GG" },
      { kind: "relative", value: "models#first#second" },
    ])("rejects invalid URI reference %#", (value) => {
      expect(isUriValue(value)).toBe(false);
    });

    it("does not execute accessor properties", () => {
      let getterCalls = 0;
      const value = Object.defineProperties(
        {},
        {
          kind: {
            get: () => {
              getterCalls += 1;
              return "relative";
            },
          },
          value: {
            get: () => {
              getterCalls += 1;
              return "models";
            },
          },
        },
      );

      expect(isUriValue(value)).toBe(false);
      expect(getterCalls).toBe(0);
    });

    it("contains property descriptor failures from hostile proxies", () => {
      const value = new Proxy(
        {},
        {
          getOwnPropertyDescriptor: () => {
            throw new Error("descriptor failure");
          },
        },
      );

      expect(isUriValue(value)).toBe(false);
    });

    it("narrows unknown values after validation", () => {
      const value: unknown = { kind: "relative", value: "./models" };

      if (!isUriValue(value)) {
        throw new Error("expected a valid URI reference");
      }

      expectTypeOf(value).toEqualTypeOf<UriValue>();
      expect(value.kind).toBe("relative");
    });
  });
});
