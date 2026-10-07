// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import type { CodecContext, ErasedRuntimeValue, PayloadDecoder } from "@evolutos/mconet-core-spi";

import { StubPayloadDecoder } from "./stub-payload-decoder.js";

/** Stable component metadata shared by decoder stub fixtures. */
const descriptor: PayloadDecoder["descriptor"] = {
  name: "stub-payload-decoder",
  version: "1.0.0",
  capabilities: new Set(),
  source: "application",
};

/** Bounded response bytes forwarded to the configured handler. */
const bytes = new Uint8Array([0x7b, 0x7d]);

/** Lifecycle context whose signal identity must cross the stub unchanged. */
const context: CodecContext = {
  signal: new AbortController().signal,
};

/** Prebuilt erased protocol value returned by the successful fixture handler. */
const value: ErasedRuntimeValue = {
  typeId: "protocol.example.response",
  schemaId: "schema://protocol.example/response/1",
  value: { choices: [] },
};

it("forwards exact inputs and returns the configured promise result", async () => {
  const expectedPromise = Promise.resolve(value);
  const decode = vi.fn(() => expectedPromise);
  const stub = new StubPayloadDecoder({ descriptor, decode });

  const promise = stub.decode(bytes, context);

  // Delegation is immediate and identity-preserving; the handler remains the
  // sole owner of asynchronous decoding and erased-value construction.
  expect(stub.descriptor).toBe(descriptor);
  expect(decode).toHaveBeenCalledExactlyOnceWith(bytes, context);
  expect(promise).toBe(expectedPromise);
  await expect(promise).resolves.toBe(value);
  expect(decode.mock.calls[0]?.[0]).toBe(bytes);
  expect(decode.mock.calls[0]?.[1]).toBe(context);
});

it("propagates an injected decoding rejection unchanged", async () => {
  const failure = new Error("injected decoding failure");
  const decode = vi.fn(() => Promise.reject(failure));
  const stub = new StubPayloadDecoder({ descriptor, decode });

  // The stub returns the handler's rejected promise without retrying, wrapping,
  // normalizing, or manufacturing a partial erased runtime value.
  const promise = stub.decode(bytes, context);
  await expect(promise).rejects.toBe(failure);
  expect(decode).toHaveBeenCalledExactlyOnceWith(bytes, context);
});

it("supports handler-controlled pending work and cancellation observation", async () => {
  const controller = new AbortController();
  const cancellationContext: CodecContext = { signal: controller.signal };
  const failure = new Error("decoding cancelled");
  const decode: PayloadDecoder["decode"] = (_bytes, suppliedContext) =>
    new Promise((_resolve, reject) => {
      // The fixture handler, rather than the stub, chooses whether and how to
      // observe the lifecycle signal while asynchronous decoding is pending.
      suppliedContext.signal.addEventListener("abort", () => reject(failure), { once: true });
    });
  const stub = new StubPayloadDecoder({ descriptor, decode });

  const promise = stub.decode(bytes, cancellationContext);
  controller.abort();

  await expect(promise).rejects.toBe(failure);
});

it("captures the configured handler reference at construction", async () => {
  const originalHandler = vi.fn(async (): Promise<ErasedRuntimeValue> => value);
  const replacementValue: ErasedRuntimeValue = {
    typeId: "protocol.example.replacement",
    value: null,
  };
  const configuration = { descriptor, decode: originalHandler };
  const stub = new StubPayloadDecoder(configuration);
  configuration.decode = async () => replacementValue;

  // Reassigning a mutable configuration object cannot change an existing stub's
  // behavior; each instance remains deterministic after construction.
  await expect(stub.decode(bytes, context)).resolves.toBe(value);
  expect(originalHandler).toHaveBeenCalledExactlyOnceWith(bytes, context);
});

it("implements only the payload decoder boundary", () => {
  // Compile-time checks preserve the exact SPI and exclude neighboring encoder,
  // transport, media-type, parsing, recording, and reset responsibilities.
  expectTypeOf<StubPayloadDecoder>().toMatchTypeOf<PayloadDecoder>();
  expectTypeOf<StubPayloadDecoder["decode"]>().toEqualTypeOf<PayloadDecoder["decode"]>();
  expectTypeOf<StubPayloadDecoder>().not.toHaveProperty("encode");
  expectTypeOf<StubPayloadDecoder>().not.toHaveProperty("send");
  expectTypeOf<StubPayloadDecoder>().not.toHaveProperty("mediaType");
  expectTypeOf<StubPayloadDecoder>().not.toHaveProperty("snapshotCalls");
  expectTypeOf<StubPayloadDecoder>().not.toHaveProperty("reset");
});
