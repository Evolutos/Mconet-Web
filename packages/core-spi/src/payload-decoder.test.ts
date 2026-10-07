// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import type { CodecContext } from "./codec-context.js";
import type { ErasedRuntimeValue } from "./erased-runtime-value.js";
import type { PayloadDecoder } from "./payload-decoder.js";
import type { RuntimeComponent } from "./runtime-component.js";

it("defines the exact asynchronous payload decoding boundary", () => {
  // RuntimeComponent supplies immutable descriptor metadata. Exact equality
  // prevents response metadata or task parsing concerns entering the method.
  expectTypeOf<PayloadDecoder>().toMatchTypeOf<RuntimeComponent>();
  expectTypeOf<PayloadDecoder["decode"]>().toEqualTypeOf<
    (bytes: Uint8Array, context: CodecContext) => Promise<ErasedRuntimeValue>
  >();
});

it("forwards response bytes and codec context without changing identity", async () => {
  const bytes = new Uint8Array([0x7b, 0x7d]);
  const context: CodecContext = { signal: new AbortController().signal };
  const value: ErasedRuntimeValue = {
    typeId: "payload.test",
    schemaId: "schema.test.v1",
    value: { text: "hello" },
  };
  const decode = vi.fn(async (): Promise<ErasedRuntimeValue> => {
    // Return the configured erased value directly; this fixture verifies SPI
    // forwarding without duplicating a concrete wire-format decoder.
    return value;
  });
  const decoder: PayloadDecoder = {
    descriptor: {
      name: "test-payload-decoder",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    decode,
  };

  // The boundary does not copy the bounded bytes or replace the cancellation
  // context, and it preserves the implementation-owned result identity.
  await expect(decoder.decode(bytes, context)).resolves.toBe(value);
  expect(decode).toHaveBeenCalledOnce();
  expect(decode).toHaveBeenCalledWith(bytes, context);
});

it("allows decoding failures to reject the returned promise unchanged", async () => {
  const decodingFailure = new Error("payload decoding failed");
  const decoder: PayloadDecoder = {
    descriptor: {
      name: "failing-payload-decoder",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    decode() {
      // The SPI does not retry or wrap decoder failures; the runtime owns final
      // phase-aware error normalization after the component call rejects.
      return Promise.reject(decodingFailure);
    },
  };
  const context: CodecContext = { signal: new AbortController().signal };

  // Identity comparison proves the decoder boundary preserves the original
  // failure until the runtime can classify it with interaction context.
  await expect(decoder.decode(new Uint8Array(), context)).rejects.toBe(decodingFailure);
});

it("does not expose encoding metadata transport authorization or parsing concerns", () => {
  // Decoder choice and media-type checks occur in Core, while neighboring stages
  // retain encoding, I/O, authorization, and protocol interpretation duties.
  expectTypeOf<PayloadDecoder>().not.toHaveProperty("encode");
  expectTypeOf<PayloadDecoder>().not.toHaveProperty("mediaType");
  expectTypeOf<PayloadDecoder>().not.toHaveProperty("send");
  expectTypeOf<PayloadDecoder>().not.toHaveProperty("apply");
  expectTypeOf<PayloadDecoder>().not.toHaveProperty("parseResponse");
});
