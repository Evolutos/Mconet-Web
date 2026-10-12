// Copyright © 2026 Mcont.

import { ModelInteractionError, type Authorization } from "@evolutos/mconet-core-domain";
import type { AuthorizationHandler } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { scheduleAuthorizationHandlerResolution } from "./schedule-authorization-handler-resolution.js";

const authorization: Authorization = { kind: "authorization.bearer" };

function handler(supported: boolean): AuthorizationHandler {
  return {
    descriptor: {
      name: "handler",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
    },
    supports: () => supported,
    apply: () => {
      throw new Error("apply");
    },
  };
}

it("returns the single compatible handler", () => {
  const match = handler(true);

  expect(
    scheduleAuthorizationHandlerResolution({
      authorization,
      handlers: [handler(false), match],
    }),
  ).toBe(match);
});

it("fails when no handler or more than one handler matches", () => {
  const none = captureInteractionError(() => {
    scheduleAuthorizationHandlerResolution({ authorization, handlers: [handler(false)] });
  });
  const many = captureInteractionError(() => {
    scheduleAuthorizationHandlerResolution({
      authorization,
      handlers: [handler(true), handler(true)],
    });
  });

  expect(none.code).toBe("authorization_handler_not_found");
  expect(many.code).toBe("ambiguous_authorization_handler");
});

function captureInteractionError(action: () => void): ModelInteractionError {
  try {
    action();
  } catch (caught) {
    if (caught instanceof ModelInteractionError) {
      return caught;
    }
    throw caught;
  }
  throw new Error("Expected a model interaction error.");
}
