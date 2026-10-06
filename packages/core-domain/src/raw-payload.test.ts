// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it } from "vitest";

import type { JsonValue } from "./json-value.js";
import { isRawPayloadWithinSizeLimit, type RawPayload } from "./raw-payload.js";

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

  describe("isRawPayloadWithinSizeLimit", () => {
    it.each([
      [0, false],
      [1, false],
      [4, false],
      [0, true],
      [3, true],
      [4, true],
    ] as const)("accepts %i retained bytes when truncated is %s", (byteLength, truncated) => {
      const payload = createRawPayload(byteLength, truncated);

      expect(isRawPayloadWithinSizeLimit(payload, 4)).toBe(true);
    });

    it.each([false, true])(
      "rejects retained bytes over the limit when truncated is %s",
      (truncated) => {
        const payload = createRawPayload(5, truncated);

        expect(isRawPayloadWithinSizeLimit(payload, 4)).toBe(false);
      },
    );

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])(
      "rejects invalid byte limit %s",
      (maxBytes) => {
        const payload = createRawPayload(0, false);

        expect(isRawPayloadWithinSizeLimit(payload, maxBytes)).toBe(false);
      },
    );

    it("measures the visible byte view instead of its backing buffer", () => {
      const backingBuffer = new Uint8Array(16);
      const payload: RawPayload = {
        bytes: backingBuffer.subarray(4, 8),
        truncated: false,
        metadata: {},
      };

      expect(payload.bytes.byteLength).toBe(4);
      expect(payload.bytes.buffer.byteLength).toBe(16);
      expect(isRawPayloadWithinSizeLimit(payload, 4)).toBe(true);
    });

    it("does not mutate the payload while checking its size", () => {
      const payload = createRawPayload(2, true);
      const originalBytes = payload.bytes;
      const originalMetadata = payload.metadata;

      expect(isRawPayloadWithinSizeLimit(payload, 2)).toBe(true);
      expect(payload.bytes).toBe(originalBytes);
      expect(payload.metadata).toBe(originalMetadata);
      expect(payload.truncated).toBe(true);
    });

    it("exposes the intended validator signature", () => {
      expectTypeOf(isRawPayloadWithinSizeLimit).toEqualTypeOf<
        (payload: RawPayload, maxBytes: number) => boolean
      >();
    });
  });
});

/**
 * Creates a minimal raw payload for size-boundary tests.
 *
 * @param byteLength Number of retained bytes to allocate.
 * @param truncated Whether source bytes were omitted before validation.
 * @returns Raw payload with empty metadata.
 */
function createRawPayload(byteLength: number, truncated: boolean): RawPayload {
  // Allocate exactly the requested view length so each table row controls the
  // single size dimension under test without unrelated metadata variation.
  return {
    bytes: new Uint8Array(byteLength),
    truncated,
    metadata: {},
  };
}
