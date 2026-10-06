// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it } from "vitest";

import { parseMediaType, type MediaType } from "./media-type.js";

it("defines an immutable media type with structured parameters", () => {
  const mediaType: MediaType = {
    type: "application",
    subtype: "problem+json",
    parameters: {
      charset: "utf-8",
      profile: "https://example.invalid/profiles/problem",
    },
  };

  expectTypeOf<MediaType>().toEqualTypeOf<{
    readonly type: string;
    readonly subtype: string;
    readonly parameters: Readonly<Record<string, string>>;
  }>();
  expect(mediaType).toEqual({
    type: "application",
    subtype: "problem+json",
    parameters: {
      charset: "utf-8",
      profile: "https://example.invalid/profiles/problem",
    },
  });
});

it("requires an explicit parameter map even when it is empty", () => {
  const mediaType: MediaType = {
    type: "application",
    subtype: "octet-stream",
    parameters: {},
  };

  expect(mediaType.parameters).toEqual({});
  expectTypeOf<{
    readonly type: string;
    readonly subtype: string;
  }>().not.toMatchTypeOf<MediaType>();
});

it("rejects mutation at compile time", () => {
  const proveReadonly = (mediaType: MediaType): void => {
    // @ts-expect-error MediaType is an immutable value contract.
    mediaType.type = "text";
    // @ts-expect-error MediaType parameter entries are immutable.
    mediaType.parameters.charset = "us-ascii";
  };

  expectTypeOf(proveReadonly).toBeFunction();
});

it("does not accept raw strings or invalid parameter containers", () => {
  expectTypeOf<string>().not.toMatchTypeOf<MediaType>();
  expectTypeOf<{
    readonly type: string;
    readonly subtype: string;
    readonly parameters: readonly string[];
  }>().not.toMatchTypeOf<MediaType>();
  expectTypeOf<{
    readonly type: string;
    readonly subtype: string;
    readonly parameters: Readonly<Record<string, number>>;
  }>().not.toMatchTypeOf<MediaType>();
});

describe("parseMediaType", () => {
  it.each([
    ["application/json", { type: "application", subtype: "json", parameters: {} }],
    ["Application/Problem+JSON", { type: "application", subtype: "problem+json", parameters: {} }],
    [
      " text/plain ; Charset=utf-8 ; format=flowed\t",
      {
        type: "text",
        subtype: "plain",
        parameters: { charset: "utf-8", format: "flowed" },
      },
    ],
    [
      'application/json; profile="https://example.invalid/profile;v=1"',
      {
        type: "application",
        subtype: "json",
        parameters: { profile: "https://example.invalid/profile;v=1" },
      },
    ],
    [
      'multipart/form-data; boundary="A\\"B\\\\C"; note=""',
      {
        type: "multipart",
        subtype: "form-data",
        parameters: { boundary: 'A"B\\C', note: "" },
      },
    ],
    [
      "application/octet-stream; Boundary=AbC123",
      {
        type: "application",
        subtype: "octet-stream",
        parameters: { boundary: "AbC123" },
      },
    ],
  ] as const)("parses %s", (input, expected) => {
    expect(parseMediaType(input)).toEqual(expected);
  });

  it.each([
    undefined,
    null,
    1,
    {},
    "",
    "application",
    "/json",
    "application/",
    "application json",
    "application//json",
    "application/json;",
    "application/json; charset",
    "application/json; charset=",
    "application/json; charset =utf-8",
    "application/json; charset= utf-8",
    "application/json; charset=utf-8; CHARSET=us-ascii",
    'application/json; profile="unterminated',
    'application/json; profile="closed"trailing',
    'application/json; profile="line\nbreak"',
    "application/json, text/plain",
    "application/模型",
    "application/json\r\n; charset=utf-8",
  ])("rejects invalid media type input %j", (input) => {
    expect(parseMediaType(input)).toBeUndefined();
  });

  it("narrows the parser result to MediaType", () => {
    const parsed = parseMediaType("application/json; charset=utf-8");
    if (!parsed) {
      throw new Error("expected a valid media type");
    }

    expectTypeOf(parsed).toEqualTypeOf<MediaType>();
    expect(parsed.parameters.charset).toBe("utf-8");
  });

  it("stores special parameter names as own data properties", () => {
    const parsed = parseMediaType("application/json; __proto__=safe; Constructor=value");
    if (!parsed) {
      throw new Error("expected a valid media type");
    }

    expect(parsed.parameters.__proto__).toBe("safe");
    expect(parsed.parameters.constructor).toBe("value");
    expect(Object.hasOwn(parsed.parameters, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(parsed.parameters)).toBe(Object.prototype);
  });
});
