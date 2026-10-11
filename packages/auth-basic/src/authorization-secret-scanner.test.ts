// Copyright © 2026 Mcont.

import { inspect } from "node:util";

import { expect, it } from "vitest";

import { SecretValue } from "@evolutos/mconet-core-domain";
import type { AuthorizationContext, TransportRequest } from "@evolutos/mconet-core-spi";

import { assertSecretAbsent } from "../../testing/src/assert-secret-absent.js";
import { ApiKeyHeaderAuthorizationHandler } from "./api-key-header-authorization-handler.js";
import { apiKeyHeaderAuthorizationKind } from "./api-key-header-authorization.js";
import { BearerAuthorizationHandler } from "./bearer-authorization-handler.js";
import { bearerAuthorizationKind } from "./bearer-authorization.js";
import { DynamicCredentialSource } from "./dynamic-credential-source.js";
import { FixedCredentialSource } from "./fixed-credential-source.js";
import { NoAuthorizationHandler } from "./no-authorization-handler.js";
import { noAuthorizationKind } from "./no-authorization.js";

/** Plaintext that must stay out of every authorization carrier except one protected header. */
const secretPlaintext = "authorization-scanner-secret";

/** API-key header that is allowed to carry the credential. */
const apiKeyHeaderName = "x-api-key";

it("keeps authorization secrets out of errors, diagnostics, and redacted requests", async () => {
  const secret = new SecretValue(secretPlaintext);
  const fixedSource = new FixedCredentialSource(secret);
  const dynamicSource = new DynamicCredentialSource(() => new SecretValue(secretPlaintext));
  const dynamicSecret = await dynamicSource.getCredential({ signal: new AbortController().signal });
  const request = createRequest();
  const context = createContext();
  const apiKeyHandler = new ApiKeyHeaderAuthorizationHandler();
  const bearerHandler = new BearerAuthorizationHandler();
  const noAuthorizationHandler = new NoAuthorizationHandler();
  const apiKeyAuthorization = {
    kind: apiKeyHeaderAuthorizationKind,
    headerName: apiKeyHeaderName,
    credentialSource: fixedSource,
  };
  const bearerAuthorization = {
    kind: bearerAuthorizationKind,
    credentialSource: fixedSource,
  };
  const apiKeyRequest = await apiKeyHandler.apply({
    request,
    authorization: apiKeyAuthorization,
    context,
  });
  const bearerRequest = await bearerHandler.apply({
    request,
    authorization: bearerAuthorization,
    context,
  });
  const unchangedRequest = await noAuthorizationHandler.apply({
    request,
    authorization: { kind: noAuthorizationKind },
    context,
  });
  const carriers = [
    String(secret),
    JSON.stringify(secret),
    inspect(secret),
    String(fixedSource),
    JSON.stringify(fixedSource),
    inspect(fixedSource),
    String(dynamicSource),
    JSON.stringify(dynamicSource),
    inspect(dynamicSource),
    String(dynamicSecret),
    JSON.stringify(dynamicSecret),
    inspect(dynamicSecret),
    withoutProtectedHeader(apiKeyRequest, apiKeyHeaderName),
    withoutProtectedHeader(bearerRequest, "authorization"),
    unchangedRequest,
    apiKeyHandler.descriptor,
    bearerHandler.descriptor,
    noAuthorizationHandler.descriptor,
    await rejection(
      apiKeyHandler.apply({
        request,
        authorization: {
          kind: apiKeyHeaderAuthorizationKind,
          headerName: `${secretPlaintext}\r\nname`,
          credentialSource: fixedSource,
        },
        context,
      }),
    ),
    await rejection(
      apiKeyHandler.apply({
        request,
        authorization: {
          kind: apiKeyHeaderAuthorizationKind,
          headerName: apiKeyHeaderName,
          credentialSource: new FixedCredentialSource(
            new SecretValue(`${secretPlaintext}\r\nX-Injected: 1`),
          ),
        },
        context,
      }),
    ),
    await rejection(
      bearerHandler.apply({
        request,
        authorization: {
          kind: bearerAuthorizationKind,
          credentialSource: new FixedCredentialSource(new SecretValue("")),
        },
        context,
      }),
    ),
    await rejection(
      bearerHandler.apply({
        request,
        authorization: {
          kind: bearerAuthorizationKind,
          credentialSource: new FixedCredentialSource(
            new SecretValue(`${secretPlaintext}\r\nx-injected`),
          ),
        },
        context,
      }),
    ),
    await rejection(
      noAuthorizationHandler.apply({
        request,
        authorization: { kind: secretPlaintext },
        context,
      }),
    ),
    await rejection(
      apiKeyHandler.apply({
        request,
        authorization: apiKeyAuthorization,
        context: createContext(true),
      }),
    ),
  ];

  assertSecretAbsent(secretPlaintext, ...carriers);
  expect(() => assertSecretAbsent(secretPlaintext, apiKeyRequest)).toThrow(
    "Secret detected in an inspected carrier.",
  );
  expect(() => assertSecretAbsent(secretPlaintext, bearerRequest)).toThrow(
    "Secret detected in an inspected carrier.",
  );
  expect(String(carriers[0])).not.toContain(secretPlaintext);
});

/**
 * Copies a request with one protected header value removed from the scan.
 *
 * @param request Authorized request that may contain one credential header.
 * @param protectedName Lowercase name of the header allowed to carry the credential.
 * @returns The same request with that header value replaced by a fixed marker.
 */
function withoutProtectedHeader(
  request: TransportRequest,
  protectedName: string,
): TransportRequest {
  return {
    method: request.method,
    url: request.url,
    headers: request.headers.map((header) =>
      header.name === protectedName ? { name: header.name, value: "[REDACTED]" } : header,
    ),
    query: request.query,
    body: request.body,
  };
}

/**
 * Captures the rejection from one authorization attempt.
 *
 * @param attempt Authorization work expected to fail.
 * @returns The thrown value.
 */
async function rejection(attempt: Promise<unknown>): Promise<unknown> {
  try {
    await attempt;
  } catch (error) {
    return error;
  }
  throw new Error("Authorization attempt completed without a failure.");
}

/**
 * Creates one encoded request that does not contain the scanner secret.
 *
 * @returns A request safe to compare after authorization.
 */
function createRequest(): TransportRequest {
  return {
    method: "POST",
    url: { kind: "absolute", value: "https://service.example.test/models/run" },
    headers: [{ name: "content-type", value: "application/json" }],
    query: [{ name: "trace", value: "public" }],
    body: { kind: "bytes", bytes: Uint8Array.of(0x7b, 0x7d) },
  };
}

/**
 * Creates authorization context, optionally already cancelled.
 *
 * @param aborted Whether the interaction signal starts aborted.
 * @returns Context whose text fields do not contain the scanner secret.
 */
function createContext(aborted = false): AuthorizationContext {
  const controller = new AbortController();
  if (aborted) {
    controller.abort();
  }
  return {
    interactionId: "interaction-scanner",
    target: {
      serviceId: "service.scanner",
      protocolId: "protocol.scanner",
      model: { name: "model-scanner", metadata: {}, extensions: {} },
      extensions: {},
    },
    endpoint: { kind: "absolute", value: "https://service.example.test" },
    transportKind: "transport.http",
    timestamp: { epochMilliseconds: 2_000_000_000_000 },
    bodySigningMode: "none",
    signal: controller.signal,
    extensions: {},
  };
}
