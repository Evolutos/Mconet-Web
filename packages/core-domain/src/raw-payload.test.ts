// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it } from "vitest";

import type { JsonValue } from "./json-value.js";
import type { RawPayload } from "./raw-payload.js";

describe("RawPayload", () => {
  it("stores bounded bytes with wire metadata", () => {
    const payload: RawPayload = {
      mediaType: "application/problem+json; charset=utf-8",
      schemaId: "problem-details",
      bytes: new Uint8Array([123, 125]),
      truncated: false,
      metadata: {
        source: "response",
        status: 400,
        retryable: false,
        tags: ["remote"],
      },
    };

    expectTypeOf<RawPayload>().toEqualTypeOf<{
      readonly mediaType?: string;
      readonly schemaId?: string;
      readonly bytes: Uint8Array;
      readonly truncated: boolean;
      readonly metadata: Readonly<Record<string, JsonValue>>;
    }>();
    expect([...payload.bytes]).toEqual([123, 125]);
    expect(payload.truncated).toBe(false);
  });

  it("allows absent optional identifiers and empty metadata", () => {
    const payload: RawPayload = {
      bytes: new Uint8Array(),
      truncated: true,
      metadata: {},
    };

    expect(payload).toEqual({
      bytes: new Uint8Array(),
      truncated: true,
      metadata: {},
    });
  });

  it("rejects field replacement and metadata mutation at compile time", () => {
    const proveReadonly = (payload: RawPayload): void => {
      // @ts-expect-error RawPayload fields are immutable references.
      payload.bytes = new Uint8Array();
      // @ts-expect-error RawPayload state cannot be rewritten.
      payload.truncated = false;
      // @ts-expect-error RawPayload metadata entries are immutable.
      payload.metadata.source = "changed";
    };

    expectTypeOf(proveReadonly).toBeFunction();
  });

  it("requires Uint8Array bytes, a truncation flag, and JSON metadata", () => {
    expectTypeOf<{
      readonly bytes: readonly number[];
      readonly truncated: boolean;
      readonly metadata: Readonly<Record<string, string>>;
    }>().not.toMatchTypeOf<RawPayload>();
    expectTypeOf<{
      readonly bytes: Uint8Array;
      readonly metadata: Readonly<Record<string, unknown>>;
    }>().not.toMatchTypeOf<RawPayload>();
    expectTypeOf<{
      readonly bytes: Uint8Array;
      readonly truncated: boolean;
      readonly metadata: Readonly<Record<string, () => void>>;
    }>().not.toMatchTypeOf<RawPayload>();
  });
});
