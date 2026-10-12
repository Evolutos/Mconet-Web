// Copyright © 2026 Mcont.

import type { Authorization } from "@evolutos/mconet-core-domain";
import type {
  AuthorizationContext,
  AuthorizationHandler,
  Transport,
  TransportRequest,
} from "@evolutos/mconet-core-spi";
import { expect, it, vi } from "vitest";

import { scheduleApplyAuthorization } from "./schedule-apply-authorization.js";

const authorization: Authorization = { kind: "authorization.bearer" };
const request: TransportRequest = {
  method: "POST",
  url: { kind: "absolute", value: "https://example.test/v1" },
  headers: [],
  query: [],
  body: { kind: "bytes", bytes: new Uint8Array() },
};
const context = {
  interactionId: "interaction-1",
  target: {
    serviceId: "service.example",
    protocolId: "protocol.example",
    model: { name: "model", metadata: {}, extensions: {} },
    extensions: {},
  },
  endpoint: { kind: "absolute", value: "https://example.test/v1" },
  transportKind: "transport.http",
  timestamp: { epochMilliseconds: 1 },
  bodySigningMode: "none",
  signal: new AbortController().signal,
  extensions: {},
} as AuthorizationContext;

function idleTransport(): Transport {
  return {
    descriptor: {
      name: "transport",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
    },
    send: vi.fn(() => {
      throw new Error("send");
    }),
  };
}

function handler(apply: AuthorizationHandler["apply"]): AuthorizationHandler {
  return {
    descriptor: {
      name: "handler",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
    },
    supports: () => true,
    apply,
  };
}

it("returns the authorized request after one apply call", async () => {
  const authorized: TransportRequest = {
    ...request,
    headers: [{ name: "authorization", value: "Bearer token" }],
  };
  const apply = vi.fn(async () => authorized);
  const transport = idleTransport();
  const result = await scheduleApplyAuthorization({
    handler: handler(apply),
    request,
    authorization,
    context,
    transport,
  });

  expect(result.value).toBe(authorized);
  expect(apply).toHaveBeenCalledOnce();
  expect(apply).toHaveBeenCalledWith({ request, authorization, context });
  expect(transport.send).not.toHaveBeenCalled();
});

it("rejects an injected header without sending or copying the value", async () => {
  const secret = "TEST_ONLY_DO_NOT_USE";
  const transport = idleTransport();
  const result = await scheduleApplyAuthorization({
    handler: handler(async () => ({
      ...request,
      headers: [{ name: "authorization", value: `Bearer ${secret}\r\nX-Injected: 1` }],
    })),
    request,
    authorization,
    context,
    transport,
  });

  expect(result.value).toBeUndefined();
  expect(result.diagnostics[0]?.code).toBe("invalid_authorization_header_value");
  expect(JSON.stringify(result.diagnostics)).not.toContain(secret);
  expect(transport.send).not.toHaveBeenCalled();
});
