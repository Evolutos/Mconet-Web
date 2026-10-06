// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { MediaType } from "./media-type.js";

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
