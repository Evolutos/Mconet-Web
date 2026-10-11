// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type { AuthorizationHandler } from "@evolutos/mconet-core-spi";

import {
  DefaultAuthorizationHandlerResolver,
  defaultAuthorizationHandlerResolverDescriptor,
} from "./default-authorization-handler-resolver.js";

const authorization = { kind: "authorization.none", token: "must-stay-out-of-the-error" };

function unsupportedHandler(): AuthorizationHandler {
  return {
    descriptor: {
      name: "unsupported-handler",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    supports: () => false,
    async apply(input) {
      return input.request;
    },
  };
}

it("reports a standard authentication error when no handler matches", () => {
  const resolver = new DefaultAuthorizationHandlerResolver();
  const handlers = [unsupportedHandler(), unsupportedHandler()];
  const handlersBefore = [...handlers];

  expect(resolver.descriptor).toBe(defaultAuthorizationHandlerResolverDescriptor);
  expect(() => resolver.resolve({ authorization, handlers })).toThrow(ModelInteractionError);
  expect(() => resolver.resolve({ authorization, handlers: [] })).toThrow(ModelInteractionError);
  try {
    resolver.resolve({ authorization, handlers: [] });
    expect.fail("no-match resolution must throw");
  } catch (error) {
    expect(error).toMatchObject({
      category: "authentication",
      phase: "authorization",
      code: "authorization_handler_not_found",
    });
    expect(String(error)).not.toContain("must-stay-out-of-the-error");
    expect(JSON.stringify(error)).not.toContain("must-stay-out-of-the-error");
  }
  expect(handlers).toEqual(handlersBefore);
  expect(authorization.kind).toBe("authorization.none");
});
