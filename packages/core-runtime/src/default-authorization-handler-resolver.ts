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

/**
 * Stable code used until the unique and ambiguous branches exist.
 * A compatible candidate must not be selected by list order.
 */
const AUTHORIZATION_HANDLER_NOT_SELECTED_CODE = "authorization_handler_not_selected";

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
 * compatible handler is returned by identity. The resolver does not read
 * credentials, call apply, mutate the description, or choose a handler by list
 * order.
 */
export class DefaultAuthorizationHandlerResolver implements AuthorizationHandlerResolver {
  /** Shared descriptor for this builtin resolver. */
  public readonly descriptor = defaultAuthorizationHandlerResolverDescriptor;

  /**
   * Resolves the unique handler for one authorization description.
   *
   * @param input Authorization description and candidate handlers.
   * @returns The single handler whose support check accepted the description.
   * @throws {ModelInteractionError} When no candidate supports the description.
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

    // Multiple compatible handlers are a later branch. Reaching that count must
    // not silently keep the first handler.
    throw new ModelInteractionError({
      message: "Authorization handler selection did not resolve a single handler.",
      category: "invalid_component_configuration",
      phase: "resolution",
      code: AUTHORIZATION_HANDLER_NOT_SELECTED_CODE,
      diagnostics: [],
    });
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
