// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Bytes } from "@evolutos/mconet-core-domain";

import type { BytesTransportBody } from "./bytes-transport-body.js";

it("defines only the fixed bytes discriminator and byte view", () => {
  // Exact equality prevents media metadata, encoding behavior, streams,
  // multipart parts, signing state, or resource callbacks from entering the body.
  expectTypeOf<BytesTransportBody>().toEqualTypeOf<{
    readonly kind: "bytes";
    readonly bytes: Bytes;
  }>();
});

it("preserves the supplied byte-view identity and order", () => {
  const bytes: Bytes = new Uint8Array([0, 127, 255]);
  const body: BytesTransportBody = { kind: "bytes", bytes };

  // The data value does not allocate another buffer or transform byte contents;
  // encoding and ownership policy remain with its producer and consumer.
  expect(body.kind).toBe("bytes");
  expect(body.bytes).toBe(bytes);
  expect(Array.from(body.bytes)).toEqual([0, 127, 255]);
});

it("represents an empty buffered request body explicitly", () => {
  const body: BytesTransportBody = {
    kind: "bytes",
    bytes: new Uint8Array(),
  };

  // An empty byte body remains a valid discriminated branch rather than null,
  // omission, an empty string, or a synthetic no-body variant.
  expect(body.bytes.byteLength).toBe(0);
  expect(Object.hasOwn(body, "bytes")).toBe(true);
});

it("prevents the branch and byte-view references from being replaced", () => {
  const proveReadonly = (body: BytesTransportBody, bytes: Bytes): void => {
    // This helper remains compile-only and deliberately makes no claim that a
    // readonly property freezes caller-owned Uint8Array contents.
    // @ts-expect-error The fixed body discriminator cannot be replaced.
    body.kind = "bytes";
    // @ts-expect-error The retained byte view cannot be replaced.
    body.bytes = bytes;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
