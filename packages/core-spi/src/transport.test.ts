// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import type { RuntimeComponent } from "./runtime-component.js";
import type { TransportContext } from "./transport-context.js";
import type { TransportRequest } from "./transport-request.js";
import type { TransportResponse } from "./transport-response.js";
import type { Transport } from "./transport.js";

it("requires runtime component metadata and one exact send operation", () => {
  // RuntimeComponent conformance exposes descriptor metadata, while the exact
  // method signature prevents domain requests, raw contexts, or decoded values.
  expectTypeOf<Transport>().toMatchTypeOf<RuntimeComponent>();
  expectTypeOf<Transport["send"]>().toEqualTypeOf<
    (request: TransportRequest, context: TransportContext) => Promise<TransportResponse>
  >();
});

it("passes request and context to an implementation and preserves its response", async () => {
  const request: TransportRequest = {
    method: "POST",
    url: { kind: "absolute", value: "https://example.invalid/models/run" },
    headers: [],
    query: [],
    body: { kind: "bytes", bytes: new Uint8Array([123, 125]) },
  };
  const context: TransportContext = {
    signal: new AbortController().signal,
    maxResponseBodyBytes: 1024,
  };
  const response: TransportResponse = {
    metadata: {
      outcome: "success",
      headers: [],
      statusCode: 200,
      extensions: {},
    },
    body: new Uint8Array([123, 125]),
  };
  const send = vi.fn(async (): Promise<TransportResponse> => {
    // Return the configured response by identity; an implementation owns I/O and
    // the interface does not wrap, decode, copy, or normalize its result.
    return response;
  });
  const transport: Transport = {
    descriptor: {
      name: "test-transport",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    send,
  };

  // Calling through the public interface forwards both exact inputs once and
  // exposes the implementation's asynchronous result without extra behavior.
  await expect(transport.send(request, context)).resolves.toBe(response);
  expect(send).toHaveBeenCalledOnce();
  expect(send).toHaveBeenCalledWith(request, context);
});

it("does not expose domain mapping codec or authorization responsibilities", () => {
  // Negative type checks keep the SPI focused on byte transport rather than
  // gradually absorbing adjacent pipeline stages.
  expectTypeOf<Transport>().not.toHaveProperty("mapRequest");
  expectTypeOf<Transport>().not.toHaveProperty("encode");
  expectTypeOf<Transport>().not.toHaveProperty("decode");
  expectTypeOf<Transport>().not.toHaveProperty("authorize");
  expectTypeOf<Transport>().not.toHaveProperty("parseResponse");
});
