// Copyright © 2026 Mcont.

import { expect, it, vi } from "vitest";

import { SecretValue } from "@evolutos/mconet-core-domain";
import type { AuthorizationContext, TransportRequest } from "@evolutos/mconet-core-spi";

import { apiKeyHeaderAuthorizationKind } from "./api-key-header-authorization.js";
import { ApiKeyHeaderAuthorizationHandler } from "./api-key-header-authorization-handler.js";
import { FixedCredentialSource } from "./fixed-credential-source.js";
import { noAuthorizationKind } from "./no-authorization.js";

const plaintext = "api-key-credential";

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

function createRequest(): TransportRequest & {
  headers: { name: string; value: string }[];
} {
  return {
    method: "POST",
    url: { kind: "absolute", value: "https://models.example.test/v1/chat" },
    headers: [{ name: "content-type", value: "application/json" }],
    query: [{ name: "trace", value: "one" }],
    body: { kind: "bytes", bytes: Uint8Array.of(1, 2, 3) },
  };
}

it("appends only the named API-key header", async () => {
  const handler = new ApiKeyHeaderAuthorizationHandler();
  const credentialSource = new FixedCredentialSource(new SecretValue(plaintext));
  const getCredential = vi.spyOn(credentialSource, "getCredential");
  const request = createRequest();
  const authorization = {
    kind: apiKeyHeaderAuthorizationKind,
    headerName: "x-api-key",
    credentialSource,
  };

  const authorized = await handler.apply({ request, authorization, context });
  request.headers.push({ name: "x-api-key", value: "changed" });

  expect(handler.supports(authorization)).toBe(true);
  expect(handler.supports({ kind: noAuthorizationKind })).toBe(false);
  expect(getCredential).toHaveBeenCalledOnce();
  expect(getCredential).toHaveBeenCalledWith({ signal: context.signal });
  expect(authorized).not.toBe(request);
  expect(authorized.headers).toEqual([
    { name: "content-type", value: "application/json" },
    { name: "x-api-key", value: plaintext },
  ]);
  expect(authorized.method).toBe(request.method);
  expect(authorized.url).toEqual(request.url);
  expect(authorized.query).toEqual([{ name: "trace", value: "one" }]);
  expect(authorized.body.bytes).toBe(request.body.bytes);
  expect(authorized.headers.filter((header) => header.value === plaintext)).toEqual([
    { name: "x-api-key", value: plaintext },
  ]);
});

it("rejects a line break in the header name before reading the credential", async () => {
  let reads = 0;
  const handler = new ApiKeyHeaderAuthorizationHandler();
  const authorization = {
    kind: apiKeyHeaderAuthorizationKind,
    headerName: "x-api-key\r\nX-Injected",
    credentialSource: {
      async getCredential() {
        reads += 1;
        return new SecretValue(plaintext);
      },
    },
  };

  await expect(
    handler.apply({ request: createRequest(), authorization, context }),
  ).rejects.toMatchObject({
    category: "authentication",
    code: "invalid_authorization_header_name",
  });
  expect(reads).toBe(0);
});

it("rejects a different authorization kind", async () => {
  const handler = new ApiKeyHeaderAuthorizationHandler();
  const request = createRequest();

  await expect(
    handler.apply({
      request,
      authorization: { kind: noAuthorizationKind },
      context,
    }),
  ).rejects.toMatchObject({
    category: "authentication",
    code: "unsupported_authorization",
  });
  expect(request.headers).toEqual([{ name: "content-type", value: "application/json" }]);
});

it("does not read a credential after cancellation", async () => {
  let reads = 0;
  const handler = new ApiKeyHeaderAuthorizationHandler();

  await expect(
    handler.apply({
      request: createRequest(),
      authorization: {
        kind: apiKeyHeaderAuthorizationKind,
        headerName: "x-api-key",
        credentialSource: {
          async getCredential() {
            reads += 1;
            return new SecretValue(plaintext);
          },
        },
      },
      context: { ...context, signal: AbortSignal.abort() },
    }),
  ).rejects.toMatchObject({
    category: "cancelled",
    code: "cancelled",
  });
  expect(reads).toBe(0);
});

it("rejects a line break in the credential without returning it", async () => {
  const handler = new ApiKeyHeaderAuthorizationHandler();
  const injected = `token\r\nX-Injected: ${plaintext}`;
  const authorization = {
    kind: apiKeyHeaderAuthorizationKind,
    headerName: "x-api-key",
    credentialSource: new FixedCredentialSource(new SecretValue(injected)),
  };

  await expect(
    handler.apply({ request: createRequest(), authorization, context }),
  ).rejects.toMatchObject({
    category: "authentication",
    code: "invalid_authorization_header_value",
  });

  try {
    await handler.apply({ request: createRequest(), authorization, context });
  } catch (error) {
    expect(String(error)).not.toContain(plaintext);
    expect(JSON.stringify(error)).not.toContain(plaintext);
  }
});
