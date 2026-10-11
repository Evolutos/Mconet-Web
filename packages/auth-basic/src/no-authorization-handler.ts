// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type {
  AuthorizationContext,
  AuthorizationHandler,
  ComponentDescriptor,
  TransportRequest,
} from "@evolutos/mconet-core-spi";

import { noAuthorizationKind, type NoAuthorization } from "./no-authorization.js";

/** Diagnostic component name. It is not a registry key or selection identity. */
const NO_AUTHORIZATION_HANDLER_NAME = "no-authorization-handler";

/** Descriptive implementation version. It is not the package version. */
const NO_AUTHORIZATION_HANDLER_VERSION = "1.0.0";

/** Stable code for a description this handler cannot apply. */
const UNSUPPORTED_AUTHORIZATION_CODE = "unsupported_authorization";

/** Stable code for authorization stopped by the interaction signal. */
const CANCELLED_AUTHORIZATION_CODE = "cancelled";

/**
 * Metadata shared by every no-authorization handler.
 *
 * Name, version, and source are diagnostic facts. The handler provides no
 * selectable capability and has no codec port. This value does not register it.
 */
export const noAuthorizationHandlerDescriptor: ComponentDescriptor = {
  name: NO_AUTHORIZATION_HANDLER_NAME,
  version: NO_AUTHORIZATION_HANDLER_VERSION,
  capabilities: new Set(),
  source: "builtin",
};

/**
 * Applies the explicit no-credential authorization scheme.
 *
 * Support matches only the fixed no-authorization kind. Application returns a
 * new request with the same method, URL, headers, query, and body bytes. It
 * adds no header and does not read a credential. The input request is not
 * mutated. An aborted interaction fails before that copy is returned.
 */
export class NoAuthorizationHandler implements AuthorizationHandler {
  /** Shared descriptor for this builtin handler. */
  public readonly descriptor = noAuthorizationHandlerDescriptor;

  /**
   * Reports whether the description is the no-credential scheme.
   *
   * @param authorization Open authorization description to inspect.
   * @returns Whether application would leave the request semantically unchanged.
   */
  public supports(authorization: { readonly kind: string }): authorization is NoAuthorization {
    // Compare the discriminator only. Other fields cannot make a different
    // scheme match, and this inspection does not read a credential.
    return authorization.kind === noAuthorizationKind;
  }

  /**
   * Returns a new request with the same transport fields.
   *
   * @param input Encoded request, no-authorization description, and safe context.
   * @returns A detached request equal to the input request.
   * @throws {ModelInteractionError} When the signal is aborted or the scheme does not match.
   */
  public async apply(input: {
    readonly request: TransportRequest;
    readonly authorization: { readonly kind: string };
    readonly context: AuthorizationContext;
  }): Promise<TransportRequest> {
    // Cancellation wins before a mismatched scheme so a stopped interaction
    // does not report an authorization-selection failure.
    if (input.context.signal.aborted) {
      throw createCancelledAuthorizationError();
    }
    if (!this.supports(input.authorization)) {
      throw createUnsupportedAuthorizationError();
    }
    return copyTransportRequest(input.request);
  }
}

/**
 * Copies transport fields without copying buffered body bytes.
 *
 * @param request Request whose observable fields are preserved.
 * @returns A new frozen request. The byte view keeps its original identity.
 */
function copyTransportRequest(request: TransportRequest): TransportRequest {
  // Share the byte view. No-authorization does not sign or consume the body,
  // so copying it would only duplicate the payload.
  return Object.freeze({
    method: request.method,
    url: Object.freeze({
      kind: request.url.kind,
      value: request.url.value,
    }),
    headers: Object.freeze(
      request.headers.map((header) =>
        Object.freeze({
          name: header.name,
          value: header.value,
        }),
      ),
    ),
    query: Object.freeze(
      request.query.map((field) =>
        Object.freeze({
          name: field.name,
          value: field.value,
        }),
      ),
    ),
    body: Object.freeze({
      kind: request.body.kind,
      bytes: request.body.bytes,
    }),
  });
}

/**
 * Creates the failure for an aborted no-authorization attempt.
 *
 * @returns An error that identifies cancellation and contains no request data.
 */
function createCancelledAuthorizationError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Authorization was cancelled.",
    category: "cancelled",
    phase: "authorization",
    code: CANCELLED_AUTHORIZATION_CODE,
    diagnostics: [],
  });
}

/**
 * Creates the failure for a description this handler does not support.
 *
 * @returns An authentication error that does not include authorization fields.
 */
function createUnsupportedAuthorizationError(): ModelInteractionError {
  // Omit the foreign kind. It can be application-defined text and is not
  // required to explain that this handler only accepts no-authorization.
  return new ModelInteractionError({
    message: "The no-authorization handler does not support the supplied authorization.",
    category: "authentication",
    phase: "authorization",
    code: UNSUPPORTED_AUTHORIZATION_CODE,
    diagnostics: [
      {
        code: UNSUPPORTED_AUTHORIZATION_CODE,
        severity: "error",
        phase: "authorization",
        message: "The no-authorization handler received a different authorization kind.",
      },
    ],
  });
}
