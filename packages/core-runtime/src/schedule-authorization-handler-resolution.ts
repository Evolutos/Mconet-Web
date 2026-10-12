// Copyright © 2026 Mcont.

import type { Authorization } from "@evolutos/mconet-core-domain";
import type { AuthorizationHandler, AuthorizationHandlerResolver } from "@evolutos/mconet-core-spi";

import { DefaultAuthorizationHandlerResolver } from "./default-authorization-handler-resolver.js";

/** Stateless builtin used only when the caller does not inject a resolver. */
const defaultAuthorizationHandlerResolver = new DefaultAuthorizationHandlerResolver();

/**
 * Schedules authorization-handler resolution.
 *
 * The selected resolver is called once. Zero compatible handlers and more than
 * one compatible handler fail through that resolver. This stage does not call
 * `apply` and does not read a credential.
 *
 * @param input Optional resolver, the authorization description, and the fixed candidates.
 * @returns The single compatible handler.
 * @throws {ModelInteractionError} When no handler matches or more than one matches.
 */
export function scheduleAuthorizationHandlerResolution(input: {
  readonly resolver?: AuthorizationHandlerResolver;
  readonly authorization: Authorization;
  readonly handlers: readonly AuthorizationHandler[];
}): AuthorizationHandler {
  const resolver = input.resolver ?? defaultAuthorizationHandlerResolver;
  return resolver.resolve({
    authorization: input.authorization,
    handlers: input.handlers,
  });
}
