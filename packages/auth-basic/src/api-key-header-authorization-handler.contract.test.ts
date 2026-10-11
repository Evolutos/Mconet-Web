// Copyright © 2026 Mcont.

import { ModelInteractionError, SecretValue } from "@evolutos/mconet-core-domain";
import type { AuthorizationContext, TransportRequest } from "@evolutos/mconet-core-spi";

import { defineAuthorizationHandlerContract } from "../../testing/src/authorization-handler-contract.js";
import { apiKeyHeaderAuthorizationKind } from "./api-key-header-authorization.js";
import { ApiKeyHeaderAuthorizationHandler } from "./api-key-header-authorization-handler.js";
import { FixedCredentialSource } from "./fixed-credential-source.js";

/** Plaintext that may appear only in the protected API-key header. */
const secretPlaintext = "api-key-contract-secret";

/** Header that receives the API key. */
const apiKeyHeaderName = "x-api-key";

/**
 * Registers the shared authorization-handler contract for the API-key header scheme.
 *
 * The credential is written once, as the value of the configured header. A line
 * break in that credential rejects the request without copying the plaintext
 * into the error.
 */
defineAuthorizationHandlerContract("ApiKeyHeaderAuthorizationHandler", () => {
  const request = createRequest();
  const context = createContext();
  const authorization = {
    kind: apiKeyHeaderAuthorizationKind,
    headerName: apiKeyHeaderName,
    credentialSource: new FixedCredentialSource(new SecretValue(secretPlaintext)),
  };
  const unsafeAuthorization = {
    kind: apiKeyHeaderAuthorizationKind,
    headerName: apiKeyHeaderName,
    credentialSource: new FixedCredentialSource(
      new SecretValue(`${secretPlaintext}\r\nX-Injected: 1`),
    ),
  };

  return {
    handler: new ApiKeyHeaderAuthorizationHandler(),
    support: { authorization, expected: true },
    secretPlaintext,
    protectedHeaderNames: [apiKeyHeaderName],
    application: {
      input: { request, authorization, context },
      expected: {
        ...request,
        headers: [...request.headers, { name: apiKeyHeaderName, value: secretPlaintext }],
      },
      getObservableCarriers: () => [],
    },
    unsafeHeaderHandler: new ApiKeyHeaderAuthorizationHandler(),
    unsafeHeader: {
      input: {
        request: createRequest(),
        authorization: unsafeAuthorization,
        context: createContext(),
      },
      injectedText: `${secretPlaintext}\r\nX-Injected: 1`,
      expected: new ModelInteractionError({
        message: "Authorization header value contains a line break.",
        category: "authentication",
        phase: "authorization",
        code: "invalid_authorization_header_value",
        diagnostics: [
          {
            code: "invalid_authorization_header_value",
            severity: "error",
            phase: "authorization",
            message: "An authorization header value must stay inside one field.",
          },
        ],
      }),
      getObservableCarriers: () => [],
    },
  };
});

/**
 * Creates an encoded request that does not already carry the API key.
 *
 * @returns A request whose headers stay free of the contract secret.
 */
function createRequest(): TransportRequest {
  return {
    method: "POST",
    url: { kind: "absolute", value: "https://service.example.test/models/run" },
    headers: [{ name: "content-type", value: "application/json" }],
    query: [],
    body: { kind: "bytes", bytes: Uint8Array.of(0x7b, 0x7d) },
  };
}

/**
 * Creates authorization context with the only supported signing mode.
 *
 * @returns Context whose signal and extensions carry no credential text.
 */
function createContext(): AuthorizationContext {
  return {
    interactionId: "interaction-contract",
    target: {
      serviceId: "service.contract",
      protocolId: "protocol.contract",
      model: { name: "model-contract", metadata: {}, extensions: {} },
      extensions: {},
    },
    endpoint: { kind: "absolute", value: "https://service.example.test" },
    transportKind: "transport.http",
    timestamp: { epochMilliseconds: 2_000_000_000_000 },
    bodySigningMode: "none",
    signal: new AbortController().signal,
    extensions: {},
  };
}
