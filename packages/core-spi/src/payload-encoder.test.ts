// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import type { CodecContext } from "./codec-context.js";
import type { ErasedRuntimeValue } from "./erased-runtime-value.js";
import type { PayloadEncoder } from "./payload-encoder.js";
import type { RuntimeComponent } from "./runtime-component.js";
import type { TransportBody } from "./transport-body.js";

it("defines the exact asynchronous payload encoding boundary", () => {
  // RuntimeComponent supplies immutable descriptor metadata. Exact method
  // equality prevents request, authorization, or transport concerns entering.
  expectTypeOf<PayloadEncoder>().toMatchTypeOf<RuntimeComponent>();
  expectTypeOf<PayloadEncoder["encode"]>().toEqualTypeOf<
    (value: ErasedRuntimeValue, context: CodecContext) => Promise<TransportBody>
  >();
});

it("forwards the erased value and codec context without changing identity", async () => {
  const value: ErasedRuntimeValue = {
    typeId: "payload.test",
    schemaId: "schema.test.v1",
    value: { text: "hello" },
  };
  const context: CodecContext = { signal: new AbortController().signal };
  const body: TransportBody = {
    kind: "bytes",
    bytes: new Uint8Array([0x7b, 0x7d]),
  };
  const encode = vi.fn(async (): Promise<TransportBody> => {
    // Return the configured body directly; this fixture verifies SPI forwarding
    // and does not duplicate a concrete wire-format implementation.
    return body;
  });
  const encoder: PayloadEncoder = {
    descriptor: {
      name: "test-payload-encoder",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    encode,
  };

  // The boundary neither unwraps the erased payload nor replaces the lifecycle
  // context, and it preserves the implementation-owned result instance.
  await expect(encoder.encode(value, context)).resolves.toBe(body);
  expect(encode).toHaveBeenCalledOnce();
  expect(encode).toHaveBeenCalledWith(value, context);
});

it("allows encoding failures to reject the returned promise unchanged", async () => {
  const encodingFailure = new Error("payload encoding failed");
  const encoder: PayloadEncoder = {
    descriptor: {
      name: "failing-payload-encoder",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    encode() {
      // The SPI adds no retry or error wrapping; the later runtime boundary
      // normalizes implementation failures into the public interaction model.
      return Promise.reject(encodingFailure);
    },
  };
  const value: ErasedRuntimeValue = { typeId: "payload.test", value: null };
  const context: CodecContext = { signal: new AbortController().signal };

  // Identity comparison proves the interface does not replace the underlying
  // failure before the runtime has enough context to classify it correctly.
  await expect(encoder.encode(value, context)).rejects.toBe(encodingFailure);
});

it("does not expose decoding authorization transport or parsing responsibilities", () => {
  // Neighboring pipeline stages retain their own narrow behavior contracts.
  expectTypeOf<PayloadEncoder>().not.toHaveProperty("decode");
  expectTypeOf<PayloadEncoder>().not.toHaveProperty("apply");
  expectTypeOf<PayloadEncoder>().not.toHaveProperty("send");
  expectTypeOf<PayloadEncoder>().not.toHaveProperty("parseResponse");
  expectTypeOf<PayloadEncoder>().not.toHaveProperty("getCredential");
});
