// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type { TransportBody } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { mapFetchBody } from "./map-fetch-body.js";

/** Text whose UTF-8 form must not appear in a body rejection. */
const secretBodyText = "body-secret-value";

it("maps an empty byte body to a new empty buffer", () => {
  const body: TransportBody = { kind: "bytes", bytes: new Uint8Array() };
  const mapped = mapFetchBody(body);

  expect(mapped).toBeInstanceOf(Uint8Array);
  expect(mapped.byteLength).toBe(0);
  expect(mapped).not.toBe(body.bytes);
});

it("maps a non-empty byte body without sharing storage", () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const mapped = mapFetchBody({ kind: "bytes", bytes });

  bytes[0] = 9;

  expect(Array.from(mapped)).toEqual([1, 2, 3, 4]);
  expect(mapped).not.toBe(bytes);
  expect(mapped.constructor).toBe(Uint8Array);
});

it("copies only the visible window of a partial byte view", () => {
  const storage = new Uint8Array([9, 1, 2, 8]);
  const bytes = storage.subarray(1, 3);
  const mapped = mapFetchBody({ kind: "bytes", bytes });

  expect(Array.from(mapped)).toEqual([1, 2]);
  expect(mapped.buffer).not.toBe(storage.buffer);
});

it("copies a byte-view subclass into a plain Uint8Array", () => {
  const bytes = new NamedBytes([5, 6]);
  const mapped = mapFetchBody({ kind: "bytes", bytes });

  expect(Array.from(mapped)).toEqual([5, 6]);
  expect(mapped).not.toBeInstanceOf(NamedBytes);
});

it.each([
  { kind: "stream", bytes: new Uint8Array([1]) },
  { kind: "bytes", bytes: [1, 2, 3] },
  { kind: "bytes" },
  null,
])("rejects the unusable body %j", (body) => {
  expect(() => mapFetchBody(body as TransportBody)).toThrow(ModelInteractionError);
});

it("rejects an unusable body without copying its bytes into the error", () => {
  const bytes = new TextEncoder().encode(secretBodyText);
  let caught: unknown;

  try {
    mapFetchBody({ kind: "stream", bytes } as unknown as TransportBody);
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(ModelInteractionError);
  if (!(caught instanceof ModelInteractionError)) {
    return;
  }

  expect(caught).toMatchObject({
    category: "invalid_request",
    phase: "transport",
    code: "invalid_fetch_body",
    diagnostics: [],
    message: "Fetch body must be a buffered byte sequence.",
  });
  expect(caught.message).not.toContain(secretBodyText);
  expect(String(caught)).not.toContain(secretBodyText);
  expect(JSON.stringify(caught)).not.toContain(secretBodyText);
});

/** Byte view subclass used to prove the mapped body is a plain array. */
class NamedBytes extends Uint8Array {}
