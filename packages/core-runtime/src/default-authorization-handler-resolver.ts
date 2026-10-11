// Copyright © 2026 Mcont.

import { ModelInteractionError, type Authorization } from "@evolutos/mconet-core-domain";
import type {
  AuthorizationHandler,
  AuthorizationHandlerResolver,
  ComponentDescriptor,
} from "@evolutos/mconet-core-spi";

/** Diagnostic component name. It is not a registry key or selection identity. */
const DEFAULT_AUTHORIZATION_HANDLER_RESOLVER_NAME = "default-authorization-handler-resolver";

/** Descriptive implementation version. It is not the package version. */
const DEFAULT_AUTHORIZATION_HANDLER_RESOLVER_VERSION = "1.0.0";

/** Stable code for an authorization description with no compatible handler. */
const AUTHORIZATION_HANDLER_NOT_FOUND_CODE = "authorization_handler_not_found";

/** Stable code for more than one compatible authorization handler. */
const AMBIGUOUS_AUTHORIZATION_HANDLER_CODE = "ambiguous_authorization_handler";

/**
 * Metadata shared by every default authorization-handler resolver.
 *
 * Name, version, and source are diagnostic facts. Resolution provides no
 * selectable capability and has no codec port. This value does not register it.
 */
export const defaultAuthorizationHandlerResolverDescriptor: ComponentDescriptor = {
  name: DEFAULT_AUTHORIZATION_HANDLER_RESOLVER_NAME,
  version: DEFAULT_AUTHORIZATION_HANDLER_RESOLVER_VERSION,
  capabilities: new Set(),
  source: "builtin",
};

/**
 * Selects an authorization handler by exact support.
 *
 * Zero compatible handlers produce a standard authentication error. Exactly one
 * compatible handler is returned by identity. More than one compatible handler
 * is an ambiguous configuration error. The resolver does not read credentials,
 * call apply, mutate the description, or choose a handler by list order.
 */
export class DefaultAuthorizationHandlerResolver implements AuthorizationHandlerResolver {
  /** Shared descriptor for this builtin resolver. */
  public readonly descriptor = defaultAuthorizationHandlerResolverDescriptor;

  /**
   * Resolves the unique handler for one authorization description.
   *
   * @param input Authorization description and candidate handlers.
   * @returns The single handler whose support check accepted the description.
   * @throws {ModelInteractionError} When no candidate supports the description,
   * or when more than one candidate does.
   */
  public resolve(input: {
    readonly authorization: Authorization;
    readonly handlers: readonly AuthorizationHandler[];
  }): AuthorizationHandler {
    const matches = input.handlers.filter((handler) => handler.supports(input.authorization));
    if (matches.length === 0) {
      throw createNoAuthorizationHandlerError();
    }

    const [match] = matches;
    if (matches.length === 1 && match !== undefined) {
      return match;
    }

    // Counting every compatible handler keeps list order from hiding ambiguity.
    throw createAmbiguousAuthorizationHandlerError(matches.length);
  }
}

/**
 * Creates the standard authentication failure for zero compatible handlers.
 *
 * @returns An error that does not include authorization or handler data.
 */
function createNoAuthorizationHandlerError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "No authorization handler supports the supplied authorization.",
    category: "authentication",
    phase: "authorization",
    code: AUTHORIZATION_HANDLER_NOT_FOUND_CODE,
    diagnostics: [
      {
        code: AUTHORIZATION_HANDLER_NOT_FOUND_CODE,
        severity: "error",
        phase: "authorization",
        message: "Authorization requires exactly one compatible handler.",
      },
    ],
  });
}

/**
 * Creates the configuration failure for more than one compatible handler.
 *
 * @param candidateCount Number of handlers whose support check succeeded.
 * @returns An error distinct from the no-match authentication failure.
 */
function createAmbiguousAuthorizationHandlerError(candidateCount: number): ModelInteractionError {
  return new ModelInteractionError({
    message: "Multiple authorization handlers support the supplied authorization.",
    category: "invalid_component_configuration",
    phase: "resolution",
    code: AMBIGUOUS_AUTHORIZATION_HANDLER_CODE,
    diagnostics: [
      {
        code: AMBIGUOUS_AUTHORIZATION_HANDLER_CODE,
        severity: "error",
        phase: "resolution",
        message: "Authorization requires exactly one compatible handler.",
        details: { candidateCount },
      },
    ],
  });
}
