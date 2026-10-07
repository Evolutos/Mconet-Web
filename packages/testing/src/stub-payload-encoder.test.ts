// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import type {
  CodecContext,
  ErasedRuntimeValue,
  PayloadEncoder,
  TransportBody,
} from "@evolutos/mconet-core-spi";

import { StubPayloadEncoder } from "./stub-payload-encoder.js";

/** Stable component metadata shared by encoder stub fixtures. */
const descriptor: PayloadEncoder["descriptor"] = {
  name: "stub-payload-encoder",
  version: "1.0.0",
  capabilities: new Set(),
  source: "application",
};

/** Validated erased protocol value forwarded to the configured handler. */
const value: ErasedRuntimeValue = {
  typeId: "protocol.example.request",
  schemaId: "schema://protocol.example/request/1",
  value: { messages: [] },
};

/** Lifecycle context whose signal identity must cross the stub unchanged. */
const context: CodecContext = {
  signal: new AbortController().signal,
};

/** Prebuilt buffered body returned by the successful fixture handler. */
const body: TransportBody = {
  kind: "bytes",
  bytes: new Uint8Array([0x7b, 0x7d]),
};

it("forwards exact inputs and returns the configured promise result", async () => {
  const expectedPromise = Promise.resolve(body);
  const encode = vi.fn(() => expectedPromise);
  const stub = new StubPayloadEncoder({ descriptor, encode });

  const promise = stub.encode(value, context);

  // Delegation is immediate and identity-preserving; the handler remains the
  // sole owner of asynchronous encoding and transport-body construction.
  expect(stub.descriptor).toBe(descriptor);
  expect(encode).toHaveBeenCalledExactlyOnceWith(value, context);
  expect(promise).toBe(expectedPromise);
  await expect(promise).resolves.toBe(body);
  expect(encode.mock.calls[0]?.[0]).toBe(value);
  expect(encode.mock.calls[0]?.[1]).toBe(context);
});

it("propagates an injected encoding rejection unchanged", async () => {
  const failure = new Error("injected encoding failure");
  const encode = vi.fn(() => Promise.reject(failure));
  const stub = new StubPayloadEncoder({ descriptor, encode });

  // The stub returns the handler's rejected promise without retrying, wrapping,
  // normalizing, or manufacturing a partial transport body.
  const promise = stub.encode(value, context);
  await expect(promise).rejects.toBe(failure);
  expect(encode).toHaveBeenCalledExactlyOnceWith(value, context);
});

it("supports handler-controlled pending work and cancellation observation", async () => {
  const controller = new AbortController();
  const cancellationContext: CodecContext = { signal: controller.signal };
  const failure = new Error("encoding cancelled");
  const encode: PayloadEncoder["encode"] = (_value, suppliedContext) =>
    new Promise((_resolve, reject) => {
      // The fixture handler, rather than the stub, chooses whether and how to
      // observe the lifecycle signal while asynchronous encoding is pending.
      suppliedContext.signal.addEventListener("abort", () => reject(failure), { once: true });
    });
  const stub = new StubPayloadEncoder({ descriptor, encode });

  const promise = stub.encode(value, cancellationContext);
  controller.abort();

  await expect(promise).rejects.toBe(failure);
});

it("captures the configured handler reference at construction", async () => {
  const originalHandler = vi.fn(async (): Promise<TransportBody> => body);
  const replacementBody: TransportBody = {
    kind: "bytes",
    bytes: new Uint8Array([0x5b, 0x5d]),
  };
  const configuration = { descriptor, encode: originalHandler };
  const stub = new StubPayloadEncoder(configuration);
  configuration.encode = async () => replacementBody;

  // Reassigning a mutable configuration object cannot change an existing stub's
  // behavior; each instance remains deterministic after construction.
  await expect(stub.encode(value, context)).resolves.toBe(body);
  expect(originalHandler).toHaveBeenCalledExactlyOnceWith(value, context);
});

it("implements only the payload encoder boundary", () => {
  // Compile-time checks preserve the exact SPI and exclude neighboring decoder,
  // transport, authorization, parsing, recording, and reset responsibilities.
  expectTypeOf<StubPayloadEncoder>().toMatchTypeOf<PayloadEncoder>();
  expectTypeOf<StubPayloadEncoder["encode"]>().toEqualTypeOf<PayloadEncoder["encode"]>();
  expectTypeOf<StubPayloadEncoder>().not.toHaveProperty("decode");
  expectTypeOf<StubPayloadEncoder>().not.toHaveProperty("send");
  expectTypeOf<StubPayloadEncoder>().not.toHaveProperty("apply");
  expectTypeOf<StubPayloadEncoder>().not.toHaveProperty("snapshotCalls");
  expectTypeOf<StubPayloadEncoder>().not.toHaveProperty("reset");
});
