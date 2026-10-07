// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type {
  Transport,
  TransportContext,
  TransportRequest,
  TransportResponse,
} from "@evolutos/mconet-core-spi";

import { MockTransport } from "./mock-transport.js";

/** Stable component metadata shared by transport mock fixtures. */
const descriptor: Transport["descriptor"] = {
  name: "mock-transport",
  version: "1.0.0",
  capabilities: new Set(),
  source: "application",
};

/** First complete transport-ready request ignored by the fixed-response mock. */
const firstRequest: TransportRequest = {
  method: "POST",
  url: { kind: "absolute", value: "https://service.example.test/models/run" },
  headers: [{ name: "content-type", value: "application/json" }],
  query: [],
  body: { kind: "bytes", bytes: new Uint8Array([0x7b, 0x7d]) },
};

/** Structurally different request used to prove response determinism. */
const secondRequest: TransportRequest = {
  method: "PUT",
  url: { kind: "relative", value: "/alternate" },
  headers: [],
  query: [{ name: "mode", value: "test" }],
  body: { kind: "bytes", bytes: new Uint8Array() },
};

/** First transport execution context ignored by the fixed-response mock. */
const firstContext: TransportContext = {
  signal: new AbortController().signal,
  deadline: 2_000_000_000_000,
  maxResponseBodyBytes: 4096,
};

/** Different context used to prove controls do not select the preset result. */
const secondContext: TransportContext = {
  signal: AbortSignal.abort(new Error("already aborted")),
  maxResponseBodyBytes: 1,
};

/** Buffered body retained by the complete configured response. */
const responseBody = new Uint8Array([0x6f, 0x6b]);

/** Deterministic protocol-neutral response returned by the mock. */
const response: TransportResponse = {
  metadata: {
    outcome: "success",
    statusCode: 200,
    headers: [{ name: "content-type", value: "application/json" }],
    mediaType: { type: "application", subtype: "json", parameters: [] },
    extensions: {},
  },
  body: responseBody,
};

it("resolves with the exact configured response", async () => {
  const transport = new MockTransport({ descriptor, response });

  const actual = await transport.send(firstRequest, firstContext);

  // The complete response crosses the mock boundary without metadata or byte
  // reconstruction, allowing identity-sensitive assertions in caller tests.
  expect(transport.descriptor).toBe(descriptor);
  expect(actual).toBe(response);
  expect(actual.metadata).toBe(response.metadata);
  expect(actual.body).toBe(responseBody);
});

it("returns one preset response for different requests and contexts", async () => {
  const transport = new MockTransport({ descriptor, response });

  const first = await transport.send(firstRequest, firstContext);
  const second = await transport.send(secondRequest, secondContext);

  // A pre-aborted signal and a different byte limit do not affect this minimal
  // mock because cancellation and limit behavior belong to concrete transports.
  expect(first).toBe(response);
  expect(second).toBe(response);
  expect(second).toBe(first);
});

it("captures the configured response reference at construction", async () => {
  const replacement: TransportResponse = {
    metadata: {
      outcome: "service_error",
      statusCode: 503,
      headers: [],
      extensions: {},
    },
    body: new Uint8Array(),
  };
  const configuration = { descriptor, response };
  const transport = new MockTransport(configuration);
  configuration.response = replacement;

  // Reassigning a mutable configuration object cannot alter an existing mock's
  // deterministic response after construction.
  await expect(transport.send(firstRequest, firstContext)).resolves.toBe(response);
});

it("implements only the non-recording transport boundary", () => {
  // Compile-time checks preserve the exact SPI and exclude mapping, codec,
  // authorization, request-recording, and reset responsibilities.
  expectTypeOf<MockTransport>().toMatchTypeOf<Transport>();
  expectTypeOf<MockTransport["send"]>().toEqualTypeOf<Transport["send"]>();
  expectTypeOf<MockTransport>().not.toHaveProperty("mapRequest");
  expectTypeOf<MockTransport>().not.toHaveProperty("encode");
  expectTypeOf<MockTransport>().not.toHaveProperty("decode");
  expectTypeOf<MockTransport>().not.toHaveProperty("snapshotCalls");
  expectTypeOf<MockTransport>().not.toHaveProperty("reset");
});
