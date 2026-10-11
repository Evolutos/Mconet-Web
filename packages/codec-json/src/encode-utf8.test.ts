// Copyright © 2026 Mcont.

import { afterEach, expect, it } from "vitest";

import { encodeUtf8 } from "./encode-utf8.js";

/** Property descriptor captured before a missing-encoder test replaces it. */
let originalTextEncoder: PropertyDescriptor | undefined;

afterEach(() => {
  // Restore the host constructor even when the assertion above throws, so later
  // files in this worker do not observe a removed TextEncoder.
  if (originalTextEncoder) {
    Object.defineProperty(globalThis, "TextEncoder", originalTextEncoder);
    originalTextEncoder = undefined;
  }
});

it("encodes an empty string as an empty byte sequence", () => {
  const bytes = encodeUtf8("");

  // Empty input is present text, not a missing value, and still yields a
  // caller-owned byte array rather than null or undefined.
  expect(bytes).toBeInstanceOf(Uint8Array);
  expect(Array.from(bytes)).toEqual([]);
});

it("encodes a non-BMP scalar that is not an emoji", () => {
  // U+10000 is the first supplementary-plane scalar and requires four UTF-8 bytes.
  expect(Array.from(encodeUtf8("𐀀"))).toEqual([0xf0, 0x90, 0x80, 0x80]);
});

it("encodes an emoji scalar", () => {
  // U+1F600 GRINNING FACE is a non-BMP emoji and must not be written as a surrogate pair.
  expect(Array.from(encodeUtf8("😀"))).toEqual([0xf0, 0x9f, 0x98, 0x80]);
});

it("encodes BMP text, a non-BMP scalar, and an emoji in one string", () => {
  // One string proves the wrapper encodes the full input in order rather than
  // only a single scalar category.
  expect(Array.from(encodeUtf8("A𐀀😀"))).toEqual([
    0x41, 0xf0, 0x90, 0x80, 0x80, 0xf0, 0x9f, 0x98, 0x80,
  ]);
});

it("replaces a lone surrogate using the host UTF-8 policy", () => {
  // A lone surrogate is not a Unicode scalar. The wrapper keeps the host
  // replacement, U+FFFD, instead of inventing a second rejection rule.
  expect(Array.from(encodeUtf8("\uD800"))).toEqual([0xef, 0xbf, 0xbd]);
});

it("returns a new byte array that later calls do not share", () => {
  const first = encodeUtf8("A");
  first[0] = 0;

  // Mutating the first result must not change the encoding of the same text.
  expect(Array.from(encodeUtf8("A"))).toEqual([0x41]);
  expect(first).not.toBe(encodeUtf8("A"));
});

it("rejects when the runtime does not provide a UTF-8 encoder", () => {
  originalTextEncoder = Object.getOwnPropertyDescriptor(globalThis, "TextEncoder");
  Object.defineProperty(globalThis, "TextEncoder", {
    configurable: true,
    value: undefined,
  });

  // The absence is reported before any byte array is produced.
  expect(() => encodeUtf8("A")).toThrow(
    new Error("UTF-8 text encoding is not available in this runtime."),
  );
});
