// Copyright © 2026 Mcont.

import { ModelInteractionError, SecretValue } from "@evolutos/mconet-core-domain";
import type { AuthorizationContext, TransportRequest } from "@evolutos/mconet-core-spi";

import { defineAuthorizationHandlerContract } from "../../testing/src/authorization-handler-contract.js";
import { bearerAuthorizationKind } from "./bearer-authorization.js";
import { BearerAuthorizationHandler } from "./bearer-authorization-handler.js";
import { FixedCredentialSource } from "./fixed-credential-source.js";

/** Plaintext that may appear only inside the protected Bearer header value. */
const secretPlaintext = "bearer-contract-secret";

/** Header name the Bearer handler always writes. */
const bearerHeaderName = "authorization";

/**
 * Registers the shared authorization-handler contract for the Bearer scheme.
 *
 * The credential is written once, after the Bearer prefix, in the authorization
 * header. A line break in that credential rejects the request without copying
 * the plaintext into the error.
 */
defineAuthorizationHandlerContract("BearerAuthorizationHandler", () => {
  const request = createRequest();
  const context = createContext();
  const authorization = {
    kind: bearerAuthorizationKind,
    credentialSource: new FixedCredentialSource(new SecretValue(secretPlaintext)),
  };
  const unsafeAuthorization = {
    kind: bearerAuthorizationKind,
    credentialSource: new FixedCredentialSource(
      new SecretValue(`${secretPlaintext}\r\nX-Injected: 1`),
    ),
  };

  return {
    handler: new BearerAuthorizationHandler(),
    support: { authorization, expected: true },
    secretPlaintext,
    protectedHeaderNames: [bearerHeaderName],
    application: {
      input: { request, authorization, context },
      expected: {
        ...request,
        headers: [
          ...request.headers,
          { name: bearerHeaderName, value: `Bearer ${secretPlaintext}` },
        ],
      },
      getObservableCarriers: () => [],
    },
    unsafeHeaderHandler: new BearerAuthorizationHandler(),
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
 * Creates an encoded request that does not already carry a Bearer credential.
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
