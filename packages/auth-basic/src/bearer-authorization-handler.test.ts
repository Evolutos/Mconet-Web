// Copyright © 2026 Mcont.

import { expect, it, vi } from "vitest";

import { SecretValue } from "@evolutos/mconet-core-domain";
import type { AuthorizationContext } from "@evolutos/mconet-core-spi";

import { BearerAuthorizationHandler } from "./bearer-authorization-handler.js";
import { bearerAuthorizationKind } from "./bearer-authorization.js";
import { FixedCredentialSource } from "./fixed-credential-source.js";
import { noAuthorizationKind } from "./no-authorization.js";

const token = "TEST_ONLY_DO_NOT_USE";

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
    url: { kind: "absolute" as const, value: "https://models.example.test/v1/chat" },
    headers: [{ name: "content-type", value: "application/json" }],
    query: [{ name: "trace", value: "one" }],
    body: { kind: "bytes" as const, bytes: Uint8Array.of(1, 2, 3) },
  };
}

it("appends one Bearer authorization header", async () => {
  const handler = new BearerAuthorizationHandler();
  const credentialSource = new FixedCredentialSource(new SecretValue(token));
  const getCredential = vi.spyOn(credentialSource, "getCredential");
  const request = createRequest();
  const authorization = { kind: bearerAuthorizationKind, credentialSource };

  const authorized = await handler.apply({ request, authorization, context });

  expect(handler.supports(authorization)).toBe(true);
  expect(handler.supports({ kind: noAuthorizationKind })).toBe(false);
  expect(getCredential).toHaveBeenCalledOnce();
  expect(authorized.headers).toEqual([
    { name: "content-type", value: "application/json" },
    { name: "authorization", value: `Bearer ${token}` },
  ]);
  expect(authorized.query).toEqual(request.query);
  expect(authorized.url).toEqual(request.url);
  expect(authorized.body.bytes).toBe(request.body.bytes);
  expect(
    JSON.stringify({ url: authorized.url, query: authorized.query, body: authorized.body }),
  ).not.toContain(token);
});

it("rejects a bearer credential that would split the header", async () => {
  const handler = new BearerAuthorizationHandler();
  const authorization = {
    kind: bearerAuthorizationKind,
    credentialSource: new FixedCredentialSource(new SecretValue(`${token}\r\nX-Injected: 1`)),
  };

  await expect(
    handler.apply({ request: createRequest(), authorization, context }),
  ).rejects.toMatchObject({
    code: "invalid_authorization_header_value",
  });

  try {
    await handler.apply({ request: createRequest(), authorization, context });
  } catch (error) {
    expect(String(error)).not.toContain(token);
  }
});

it("rejects an empty bearer credential", async () => {
  const handler = new BearerAuthorizationHandler();

  await expect(
    handler.apply({
      request: createRequest(),
      authorization: {
        kind: bearerAuthorizationKind,
        credentialSource: new FixedCredentialSource(new SecretValue("")),
      },
      context,
    }),
  ).rejects.toMatchObject({ code: "unsafe_authorization_header" });
});
