// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import type {
  Transport,
  TransportContext,
  TransportRequest,
  TransportResponse,
} from "@evolutos/mconet-core-spi";

import { RecordingTransport } from "./recording-transport.js";

/** Stable component metadata shared by recording transport fixtures. */
const descriptor: Transport["descriptor"] = {
  name: "recording-transport",
  version: "1.0.0",
  capabilities: new Set(),
  source: "application",
};

/** Complete request whose URL, headers, body, and identity are recorded. */
const firstRequest: TransportRequest = {
  method: "POST",
  url: { kind: "absolute", value: "https://service.example.test/run" },
  headers: [{ name: "authorization", value: "Bearer test-token" }],
  query: [{ name: "mode", value: "test" }],
  body: { kind: "bytes", bytes: new Uint8Array([0x7b, 0x7d]) },
};

/** Second distinct request used to verify ordered call history. */
const secondRequest: TransportRequest = {
  method: "GET",
  url: { kind: "relative", value: "/health" },
  headers: [],
  query: [],
  body: { kind: "bytes", bytes: new Uint8Array() },
};

/** First execution context whose signal identity is recorded. */
const firstContext: TransportContext = {
  signal: new AbortController().signal,
  deadline: 2_000_000_000_000,
  maxResponseBodyBytes: 4096,
};

/** Second distinct context used to verify ordered pairing. */
const secondContext: TransportContext = {
  signal: new AbortController().signal,
  maxResponseBodyBytes: 128,
};

/** Deterministic response returned by successful handlers. */
const response: TransportResponse = {
  metadata: { outcome: "success", statusCode: 200, headers: [], extensions: {} },
  body: new Uint8Array([0x6f, 0x6b]),
};

it("records URL headers body and signal while preserving delegation identities", async () => {
  const expectedPromise = Promise.resolve(response);
  const send = vi.fn(() => expectedPromise);
  const transport = new RecordingTransport({ descriptor, send });

  const promise = transport.send(firstRequest, firstContext);
  const [call] = transport.snapshotCalls();

  // One immutable call entry retains the exact request and context so every
  // required transport observation remains available without duplicate models.
  expect(transport.descriptor).toBe(descriptor);
  expect(send).toHaveBeenCalledExactlyOnceWith(firstRequest, firstContext);
  expect(promise).toBe(expectedPromise);
  await expect(promise).resolves.toBe(response);
  expect(call?.request).toBe(firstRequest);
  expect(call?.request.url).toBe(firstRequest.url);
  expect(call?.request.headers).toBe(firstRequest.headers);
  expect(call?.request.body).toBe(firstRequest.body);
  expect(call?.context).toBe(firstContext);
  expect(call?.context.signal).toBe(firstContext.signal);
  expect(Object.isFrozen(call)).toBe(true);
});

it("preserves invocation order and request-context pairing", async () => {
  const transport = new RecordingTransport({
    descriptor,
    send: () => Promise.resolve(response),
  });

  await transport.send(firstRequest, firstContext);
  await transport.send(secondRequest, secondContext);

  // Entries remain paired and ordered rather than splitting fields into mutable
  // parallel arrays that could drift out of alignment.
  const calls = transport.snapshotCalls();
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual({ request: firstRequest, context: firstContext });
  expect(calls[1]).toEqual({ request: secondRequest, context: secondContext });
  expect(calls[0]?.request).toBe(firstRequest);
  expect(calls[1]?.context).toBe(secondContext);
});

it("records failed attempts before propagating the same rejection", async () => {
  const failure = new Error("transport failed");
  const transport = new RecordingTransport({
    descriptor,
    send: () => Promise.reject(failure),
  });

  // Recording occurs before delegation so a rejected send remains diagnosable;
  // no retry, response fabrication, or error wrapping is introduced.
  await expect(transport.send(firstRequest, firstContext)).rejects.toBe(failure);
  expect(transport.snapshotCalls()).toEqual([{ request: firstRequest, context: firstContext }]);
});

it("returns frozen snapshots detached from later calls", async () => {
  const transport = new RecordingTransport({
    descriptor,
    send: () => Promise.resolve(response),
  });
  await transport.send(firstRequest, firstContext);
  const firstSnapshot = transport.snapshotCalls();

  await transport.send(secondRequest, secondContext);
  const secondSnapshot = transport.snapshotCalls();

  // Later sends cannot change an earlier assertion, and consumers cannot mutate
  // either the snapshot array or its frozen input-pair entries.
  expect(firstSnapshot).toHaveLength(1);
  expect(secondSnapshot).toHaveLength(2);
  expect(firstSnapshot).not.toBe(secondSnapshot);
  expect(Object.isFrozen(firstSnapshot)).toBe(true);
  expect(Reflect.deleteProperty(firstSnapshot, "0")).toBe(false);
  expect(Reflect.set(firstSnapshot[0] ?? {}, "request", secondRequest)).toBe(false);
  expect(transport.snapshotCalls()).toHaveLength(2);
});

it("implements only transport delegation and read-only call observation", () => {
  // Compile-time checks keep the production SPI exact while excluding I/O,
  // decoding, authorization, mutable histories, and reset controls.
  expectTypeOf<RecordingTransport>().toMatchTypeOf<Transport>();
  expectTypeOf<RecordingTransport["send"]>().toEqualTypeOf<Transport["send"]>();
  expectTypeOf<RecordingTransport>().not.toHaveProperty("decode");
  expectTypeOf<RecordingTransport>().not.toHaveProperty("authorize");
  expectTypeOf<RecordingTransport>().not.toHaveProperty("calls");
  expectTypeOf<RecordingTransport>().not.toHaveProperty("reset");
});
