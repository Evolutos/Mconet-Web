// Copyright © 2026 Mcont.

import { SecretValue, type Authorization } from "@evolutos/mconet-core-domain";
import type {
  AuthorizationContext,
  AuthorizationHandler,
  TransportRequest,
} from "@evolutos/mconet-core-spi";

import { defineAuthorizationHandlerContract } from "./authorization-handler-contract.js";
import { StubAuthorizationHandler } from "./stub-authorization-handler.js";

/** Registers the shared suite against deterministic authorization handlers. */
defineAuthorizationHandlerContract("StubAuthorizationHandler", () => {
  // Recreate secret, request, context, handlers, and diagnostic observations for
  // each contract case so no plaintext or mutable state crosses test boundaries.
  const secretPlaintext = "contract-secret-credential";
  const secret = new SecretValue(secretPlaintext);
  const authorization: Authorization = { kind: "authorization.contract" };
  const request: TransportRequest = {
    method: "POST",
    url: { kind: "absolute", value: "https://service.example.test/models/run" },
    headers: [{ name: "content-type", value: "application/json" }],
    query: [],
    body: { kind: "bytes", bytes: new Uint8Array([0x7b, 0x7d]) },
  };
  const context: AuthorizationContext = {
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
  const authorizedRequest = secret.expose<TransportRequest>((plaintext) => ({
    ...request,
    headers: [...request.headers, { name: "authorization", value: `Bearer ${plaintext}` }],
  }));
  const unsafeHeaderText = secret.expose((plaintext) => `Bearer ${plaintext}\r\nx-injected: true`);
  const unsafeHeaderError = new TypeError("authorization header contains a line break");
  const descriptor: AuthorizationHandler["descriptor"] = {
    name: "contract-authorization-handler",
    version: "1.0.0",
    capabilities: new Set(),
    source: "application",
  };
  const observedApplicationCarriers: unknown[] = [];
  const observedUnsafeCarriers: unknown[] = [];
  const handler = new StubAuthorizationHandler({
    descriptor,
    supports: (value) => value.kind === authorization.kind,
    apply: () => {
      // Record only redacted implicit representations before returning the new
      // request whose protected header is the sole plaintext-bearing carrier.
      observedApplicationCarriers.push(String(secret), JSON.stringify(secret), descriptor);
      return Promise.resolve(authorizedRequest);
    },
  });
  const unsafeHeaderHandler = new StubAuthorizationHandler({
    descriptor,
    supports: (value) => value.kind === authorization.kind,
    apply: () => {
      // Reject before constructing a TransportRequest and expose only safe error
      // metadata to the diagnostic carrier observed by the reusable suite.
      observedUnsafeCarriers.push({ event: "authorization_rejected", error: unsafeHeaderError });
      return Promise.reject(unsafeHeaderError);
    },
  });
  const input = { request, authorization, context };

  // Carrier callbacks reveal accumulated diagnostic data without placing test
  // hooks, plaintext, or logging responsibilities on the production SPI.
  return {
    handler,
    support: { authorization, expected: true },
    secretPlaintext,
    protectedHeaderNames: ["authorization"],
    application: {
      input,
      expected: authorizedRequest,
      getObservableCarriers: () => observedApplicationCarriers,
    },
    unsafeHeaderHandler,
    unsafeHeader: {
      input,
      injectedText: unsafeHeaderText,
      expected: unsafeHeaderError,
      getObservableCarriers: () => observedUnsafeCarriers,
    },
  };
});
