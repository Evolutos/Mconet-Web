// Copyright © 2026 Mcont.

import type { Authorization } from "@evolutos/mconet-core-domain";
import type { AuthorizationHandler, AuthorizationHandlerResolver } from "@evolutos/mconet-core-spi";

import { defineAuthorizationHandlerResolverContract } from "./authorization-handler-resolver-contract.js";

/** Registers the shared suite against a deterministic unique-match resolver. */
defineAuthorizationHandlerResolverContract("UniqueAuthorizationHandlerResolver", () => {
  // Each fixture owns independent handlers and errors so repeated resolver calls
  // cannot be affected by state retained from another contract case.
  const authorization: Authorization = { kind: "authorization.contract" };
  const createHandler = (name: string, supportedKind: string): AuthorizationHandler => ({
    descriptor: {
      name,
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    supports(value): boolean {
      // Match only the configured open authorization kind without reading a
      // credential, request, or mutable registry.
      return value.kind === supportedKind;
    },
    apply({ request }) {
      // Resolver tests never authorize a request; returning the supplied value
      // keeps this handler structurally complete without unrelated behavior.
      return Promise.resolve(request);
    },
  });
  const matchingHandler = createHandler("matching-handler", authorization.kind);
  const secondMatchingHandler = createHandler("second-matching-handler", authorization.kind);
  const otherHandler = createHandler("other-handler", "authorization.other");
  const noneError = new Error("no authorization handler matched the request");
  const manyError = new Error("multiple authorization handlers matched the request");
  const resolver: AuthorizationHandlerResolver = {
    descriptor: {
      name: "contract-authorization-handler-resolver",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    resolve(input) {
      // Inspect every candidate before deciding so declaration order cannot turn
      // an ambiguous match into an apparently successful resolution.
      const matches = input.handlers.filter((handler) => handler.supports(input.authorization));
      const [match] = matches;
      if (match === undefined) {
        throw noneError;
      }
      if (matches.length > 1) {
        throw manyError;
      }

      // Return the configured instance directly without cloning, wrapping, or
      // constructing a new handler after the unique-match check succeeds.
      return match;
    },
  };

  // Inputs intentionally cover zero, exactly one, and two compatible handlers
  // while retaining at least one non-matching candidate where useful.
  return {
    resolver,
    one: {
      input: { authorization, handlers: [otherHandler, matchingHandler] },
      expected: matchingHandler,
    },
    none: {
      input: { authorization, handlers: [otherHandler] },
      expected: noneError,
    },
    many: {
      input: { authorization, handlers: [matchingHandler, otherHandler, secondMatchingHandler] },
      expected: manyError,
    },
  };
});
