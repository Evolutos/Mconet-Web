// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type { AuthorizationContext } from "@evolutos/mconet-core-spi";

import { apiKeyHeaderAuthorizationKind } from "./api-key-header-authorization.js";
import { noAuthorizationKind } from "./no-authorization.js";
import {
  NoAuthorizationHandler,
  noAuthorizationHandlerDescriptor,
} from "./no-authorization-handler.js";

const context: AuthorizationContext = {
  interactionId: "interaction.test",
  target: {
    serviceId: "service.test",
    protocolId: "protocol.test",
    model: { name: "model", metadata: {}, extensions: {} },
    extensions: {},
  },
  endpoint: { kind: "absolute", value: "https://models.example.test/v1" },
  transportKind: "transport.http",
  timestamp: { epochMilliseconds: 1_700_000_000_000 },
  bodySigningMode: "none",
  signal: new AbortController().signal,
  extensions: {},
};

function createRequest() {
  return {
    method: "POST",
    url: { kind: "absolute", value: "https://models.example.test/v1/chat" },
    headers: [
      { name: "content-type", value: "application/json" },
      { name: "x-feature", value: "alpha" },
    ],
    query: [{ name: "trace", value: "one" }],
    body: { kind: "bytes", bytes: Uint8Array.of(1, 2, 3) },
  };
}

it("supports only the fixed no-authorization kind", () => {
  const handler = new NoAuthorizationHandler();

  expect(handler.descriptor).toBe(noAuthorizationHandlerDescriptor);
  expect(handler.supports({ kind: noAuthorizationKind })).toBe(true);
  expect(handler.supports({ kind: apiKeyHeaderAuthorizationKind })).toBe(false);
  expect(handler.supports({ kind: "authorization.bearer" })).toBe(false);
});

it("returns an equal request without adding headers or sharing mutable collections", async () => {
  const handler = new NoAuthorizationHandler();
  const request = createRequest();
  const authorization = { kind: noAuthorizationKind };
  const snapshot = structuredClone(request);

  const authorized = await handler.apply({ request, authorization, context });
  request.headers.push({ name: "authorization", value: "secret-token" });

  // The transport fields stay the same, including repeated header order and the
  // original byte view. The result is a new request so the input can still change.
  expect(authorized).not.toBe(request);
  expect(authorized).toEqual(snapshot);
  expect(authorized.body.bytes).toBe(request.body.bytes);
  expect(authorized.headers).not.toBe(request.headers);
  expect(request).not.toEqual(snapshot);
});

it("rejects a different authorization kind without changing the request", async () => {
  const handler = new NoAuthorizationHandler();
  const request = createRequest();
  const snapshot = structuredClone(request);

  await expect(
    handler.apply({
      request,
      authorization: { kind: "authorization.bearer" },
      context,
    }),
  ).rejects.toMatchObject({
    category: "authentication",
    phase: "authorization",
    code: "unsupported_authorization",
  });
  expect(request).toEqual(snapshot);
});

it("rejects an aborted no-authorization attempt", async () => {
  const handler = new NoAuthorizationHandler();

  await expect(
    handler.apply({
      request: createRequest(),
      authorization: { kind: noAuthorizationKind },
      context: { ...context, signal: AbortSignal.abort() },
    }),
  ).rejects.toBeInstanceOf(ModelInteractionError);
});
