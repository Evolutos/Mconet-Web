// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import type { Authorization } from "@evolutos/mconet-core-domain";

import type { AuthorizationContext } from "./authorization-context.js";
import type { AuthorizationHandler } from "./authorization-handler.js";
import type { RuntimeComponent } from "./runtime-component.js";
import type { TransportRequest } from "./transport-request.js";

it("defines only support inspection and asynchronous request application", () => {
  // RuntimeComponent conformance supplies descriptor metadata. Exact method
  // signatures prevent handlers from receiving model payloads or transport state.
  expectTypeOf<AuthorizationHandler>().toMatchTypeOf<RuntimeComponent>();
  expectTypeOf<AuthorizationHandler["supports"]>().toEqualTypeOf<
    (authorization: Authorization) => boolean
  >();
  expectTypeOf<AuthorizationHandler["apply"]>().toEqualTypeOf<
    (input: {
      readonly request: TransportRequest;
      readonly authorization: Authorization;
      readonly context: AuthorizationContext;
    }) => Promise<TransportRequest>
  >();
});

it("inspects authorization without requiring a request or credential context", () => {
  const handler: AuthorizationHandler = {
    descriptor: {
      name: "test-authorization-handler",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    supports(authorization): boolean {
      // Match only the owned open authorization kind; support inspection performs
      // no credential read, request mutation, encoding, or network operation.
      return authorization.kind === "authorization.test";
    },
    async apply({ request }): Promise<TransportRequest> {
      // This fixture returns the request unchanged because application behavior
      // and credential integration belong to concrete handler implementations.
      return request;
    },
  };

  // Standard and future authorization values use the same open support path.
  expect(handler.supports({ kind: "authorization.test" })).toBe(true);
  expect(handler.supports({ kind: "authorization.other" })).toBe(false);
});

it("receives one immutable input bundle and preserves the returned request", async () => {
  const request: TransportRequest = {
    method: "POST",
    url: { kind: "absolute", value: "https://example.invalid/models/run" },
    headers: [],
    query: [],
    body: { kind: "bytes", bytes: new Uint8Array() },
  };
  const authorization: Authorization = { kind: "authorization.test" };
  const context: AuthorizationContext = {
    interactionId: "interaction-1",
    target: {
      serviceId: "service.test",
      protocolId: "protocol.test",
      model: {
        name: "model-test",
        metadata: {},
        extensions: {},
      },
      extensions: {},
    },
    endpoint: { kind: "absolute", value: "https://example.invalid" },
    transportKind: "transport.http",
    timestamp: { epochMilliseconds: 1_780_809_000_000 },
    bodySigningMode: "none",
    signal: new AbortController().signal,
    extensions: {},
  };
  const authorizedRequest: TransportRequest = {
    ...request,
    headers: [{ name: "authorization", value: "REDACTED" }],
  };
  const apply = vi.fn(async (): Promise<TransportRequest> => {
    // Return a distinct immutable snapshot; the SPI does not mutate the source
    // request or wrap the implementation's asynchronous result.
    return authorizedRequest;
  });
  const handler: AuthorizationHandler = {
    descriptor: {
      name: "test-authorization-handler",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    supports: () => true,
    apply,
  };
  const input = { request, authorization, context } as const;

  // The exact bundle crosses the boundary once, while the original request
  // remains unchanged and the handler-owned result identity is preserved.
  await expect(handler.apply(input)).resolves.toBe(authorizedRequest);
  expect(apply).toHaveBeenCalledOnce();
  expect(apply).toHaveBeenCalledWith(input);
  expect(request.headers).toEqual([]);
});

it("does not expose credential transport codec or response responsibilities", () => {
  // Neighboring pipeline behavior remains in dedicated SPI contracts.
  expectTypeOf<AuthorizationHandler>().not.toHaveProperty("getCredential");
  expectTypeOf<AuthorizationHandler>().not.toHaveProperty("send");
  expectTypeOf<AuthorizationHandler>().not.toHaveProperty("encode");
  expectTypeOf<AuthorizationHandler>().not.toHaveProperty("decode");
  expectTypeOf<AuthorizationHandler>().not.toHaveProperty("parseResponse");
});
