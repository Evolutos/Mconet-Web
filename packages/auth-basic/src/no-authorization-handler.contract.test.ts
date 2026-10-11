// Copyright © 2026 Mcont.

import { ModelInteractionError, type Authorization } from "@evolutos/mconet-core-domain";
import type { AuthorizationContext, TransportRequest } from "@evolutos/mconet-core-spi";

import { defineAuthorizationHandlerContract } from "../../testing/src/authorization-handler-contract.js";
import { noAuthorizationKind } from "./no-authorization.js";
import { NoAuthorizationHandler } from "./no-authorization-handler.js";

/** Plaintext that no-authorization must not copy into any observable carrier. */
const secretPlaintext = "no-auth-contract-secret";

/**
 * Registers the shared authorization-handler contract for no-authorization.
 *
 * The handler adds no credential. The preserved header only marks the protected
 * boundary required by the contract, and the plaintext stays out of every carrier.
 */
defineAuthorizationHandlerContract("NoAuthorizationHandler", () => {
  const authorization: Authorization = { kind: noAuthorizationKind };
  const request = createRequest([
    { name: "content-type", value: "application/json" },
    { name: "authorization", value: "Bearer public-marker" },
  ]);
  const context = createContext();
  const unsafeRequest = createRequest([
    { name: "content-type", value: "application/json" },
    { name: "authorization", value: `${secretPlaintext}\r\nX-Injected: 1` },
  ]);

  return {
    handler: new NoAuthorizationHandler(),
    support: { authorization, expected: true },
    secretPlaintext,
    protectedHeaderNames: ["authorization"],
    application: {
      input: { request, authorization, context },
      expected: request,
      getObservableCarriers: () => [],
    },
    unsafeHeaderHandler: new NoAuthorizationHandler(),
    unsafeHeader: {
      input: { request: unsafeRequest, authorization, context: createContext() },
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
 * Creates one encoded request without placing the contract secret in safe fields.
 *
 * @param headers Header occurrences for this contract case.
 * @returns A request the no-authorization handler can copy or reject.
 */
function createRequest(headers: TransportRequest["headers"]): TransportRequest {
  return {
    method: "POST",
    url: { kind: "absolute", value: "https://service.example.test/models/run" },
    headers,
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
