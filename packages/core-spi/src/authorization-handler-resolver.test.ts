// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import type { Authorization } from "@evolutos/mconet-core-domain";

import type { AuthorizationHandler } from "./authorization-handler.js";
import type { AuthorizationHandlerResolver } from "./authorization-handler-resolver.js";
import type { RuntimeComponent } from "./runtime-component.js";

/** Creates a request-inert handler fixture that supports exactly one authorization kind. */
const createHandler = (name: string, supportedKind: string): AuthorizationHandler => ({
  descriptor: {
    name,
    version: "1.0.0",
    capabilities: new Set(),
    source: "application",
  },
  supports(authorization): boolean {
    // Each fixture owns exactly one authorization kind so tests can model a
    // unique match without introducing credential or request-side behavior.
    return authorization.kind === supportedKind;
  },
  async apply({ request }) {
    // Resolution tests never authorize requests; returning the supplied request
    // keeps the fixture structurally complete without adding unrelated behavior.
    return request;
  },
});

it("defines a synchronous unique-handler resolution boundary", () => {
  // RuntimeComponent conformance supplies resolver metadata. Exact method typing
  // preserves the atomic authorization input and immutable candidate collection.
  expectTypeOf<AuthorizationHandlerResolver>().toMatchTypeOf<RuntimeComponent>();
  expectTypeOf<AuthorizationHandlerResolver["resolve"]>().toEqualTypeOf<
    (input: {
      readonly authorization: Authorization;
      readonly handlers: readonly AuthorizationHandler[];
    }) => AuthorizationHandler
  >();
});

it("returns the sole matching handler without reading credentials or requests", () => {
  const selectedHandler = createHandler("selected-handler", "authorization.selected");
  const otherHandler = createHandler("other-handler", "authorization.other");
  const resolve = vi.fn(
    (input: {
      readonly authorization: Authorization;
      readonly handlers: readonly AuthorizationHandler[];
    }): AuthorizationHandler => {
      // The sample implementation demonstrates the required unique-match rule;
      // production failure construction belongs to the later resolver component.
      const matches = input.handlers.filter((handler) => handler.supports(input.authorization));
      const [match] = matches;
      if (match === undefined || matches.length !== 1) {
        throw new Error("authorization handler resolution requires exactly one match");
      }
      return match;
    },
  );
  const resolver: AuthorizationHandlerResolver = {
    descriptor: {
      name: "test-authorization-handler-resolver",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    resolve,
  };
  const input = {
    authorization: { kind: "authorization.selected" },
    handlers: [otherHandler, selectedHandler] as const,
  };

  // Identity preservation proves that resolution selects a configured instance
  // rather than cloning, wrapping, or constructing an implicit handler.
  expect(resolver.resolve(input)).toBe(selectedHandler);
  expect(resolve).toHaveBeenCalledOnce();
  expect(resolve).toHaveBeenCalledWith(input);
});

it("allows implementations to reject both missing and ambiguous matches", () => {
  const matchingHandler = createHandler("matching-handler", "authorization.test");
  const resolve = (input: {
    readonly authorization: Authorization;
    readonly handlers: readonly AuthorizationHandler[];
  }): AuthorizationHandler => {
    // Count every compatible candidate before returning so candidate order can
    // never turn an ambiguous configuration into a successful first match.
    const matches = input.handlers.filter((handler) => handler.supports(input.authorization));
    const [match] = matches;
    if (match === undefined || matches.length !== 1) {
      throw new Error(`expected one authorization handler, received ${matches.length}`);
    }
    return match;
  };
  const resolver: AuthorizationHandlerResolver = {
    descriptor: {
      name: "strict-authorization-handler-resolver",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    resolve,
  };
  const authorization: Authorization = { kind: "authorization.test" };

  // Zero and multiple matches remain explicit resolver failures. Their standard
  // domain diagnostics are added with the concrete resolver implementation.
  expect(() => resolver.resolve({ authorization, handlers: [] })).toThrow(
    "expected one authorization handler, received 0",
  );
  expect(() =>
    resolver.resolve({ authorization, handlers: [matchingHandler, matchingHandler] }),
  ).toThrow("expected one authorization handler, received 2");
});

it("does not expose credential request transport or body-signing responsibilities", () => {
  // Those stages have dedicated contracts or later guards and must not expand
  // the resolver's minimum selection authority.
  expectTypeOf<AuthorizationHandlerResolver>().not.toHaveProperty("getCredential");
  expectTypeOf<AuthorizationHandlerResolver>().not.toHaveProperty("apply");
  expectTypeOf<AuthorizationHandlerResolver>().not.toHaveProperty("send");
  expectTypeOf<AuthorizationHandlerResolver>().not.toHaveProperty("bodySigningMode");
});
