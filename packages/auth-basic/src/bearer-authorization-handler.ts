// Copyright © 2026 Mcont.

import { ModelInteractionError, SecretValue } from "@evolutos/mconet-core-domain";
import type {
  AuthorizationContext,
  AuthorizationHandler,
  ComponentDescriptor,
  CredentialSource,
  TransportRequest,
} from "@evolutos/mconet-core-spi";

import { bearerAuthorizationKind, type BearerAuthorization } from "./bearer-authorization.js";

/** Diagnostic component name. It is not a registry key or selection identity. */
const BEARER_AUTHORIZATION_HANDLER_NAME = "bearer-authorization-handler";

/** Descriptive implementation version. It is not the package version. */
const BEARER_AUTHORIZATION_HANDLER_VERSION = "1.0.0";

/** Stable code for a description this handler cannot apply. */
const UNSUPPORTED_AUTHORIZATION_CODE = "unsupported_authorization";

/** Stable code for authorization stopped by the interaction signal. */
const CANCELLED_AUTHORIZATION_CODE = "cancelled";

/** Stable code for a Bearer value that would inject another header. */
const UNSAFE_AUTHORIZATION_HEADER_CODE = "unsafe_authorization_header";

/** Lowercase header name used for the HTTP Authorization field. */
const BEARER_HEADER_NAME = "authorization";

/** Scheme token that precedes the credential in the header value. */
const BEARER_SCHEME = "Bearer";

/** Line breaks that would split one header field into additional fields. */
const headerLineBreak = /[\r\n]/u;

/**
 * Metadata shared by every Bearer authorization handler.
 *
 * Name, version, and source are diagnostic facts. The handler provides no
 * selectable capability and has no codec port. This value does not register it.
 */
export const bearerAuthorizationHandlerDescriptor: ComponentDescriptor = {
  name: BEARER_AUTHORIZATION_HANDLER_NAME,
  version: BEARER_AUTHORIZATION_HANDLER_VERSION,
  capabilities: new Set(),
  source: "builtin",
};

/**
 * Adds one HTTP Bearer authorization header.
 *
 * Support matches only the Bearer scheme. Application reads the credential
 * once and appends `authorization: Bearer <credential>`. The credential is not
 * written anywhere else. A line break in the credential fails before a request
 * is returned, and the scheme prefix is not taken from the credential itself.
 */
export class BearerAuthorizationHandler implements AuthorizationHandler {
  /** Shared descriptor for this builtin handler. */
  public readonly descriptor = bearerAuthorizationHandlerDescriptor;

  /**
   * Reports whether the description is the Bearer scheme.
   *
   * @param authorization Open authorization description to inspect.
   * @returns Whether the kind and credential source are present.
   */
  public supports(authorization: { readonly kind: string }): authorization is BearerAuthorization {
    return (
      authorization.kind === bearerAuthorizationKind &&
      readCredentialSource(authorization) !== undefined
    );
  }

  /**
   * Appends the Bearer authorization header to a new request.
   *
   * @param input Encoded request, Bearer description, and safe context.
   * @returns A request equal to the input plus one Bearer header.
   * @throws {ModelInteractionError} When the scheme, signal, or credential is unsafe.
   */
  public async apply(input: {
    readonly request: TransportRequest;
    readonly authorization: { readonly kind: string };
    readonly context: AuthorizationContext;
  }): Promise<TransportRequest> {
    if (input.context.signal.aborted) {
      throw createCancelledAuthorizationError();
    }
    const credentialSource = this.supports(input.authorization)
      ? readCredentialSource(input.authorization)
      : undefined;
    if (credentialSource === undefined) {
      throw createUnsupportedAuthorizationError();
    }

    const secret = await credentialSource.getCredential({ signal: input.context.signal });
    if (input.context.signal.aborted) {
      throw createCancelledAuthorizationError();
    }
    if (!(secret instanceof SecretValue)) {
      throw createUnsupportedAuthorizationError();
    }

    const token = secret.expose((value) => value);
    if (token.length === 0 || headerLineBreak.test(token)) {
      throw createUnsafeAuthorizationHeaderError();
    }

    return appendHeader(input.request, BEARER_HEADER_NAME, `${BEARER_SCHEME} ${token}`);
  }
}

/**
 * Reads an own credential source without calling it.
 *
 * @param value Authorization description to inspect.
 * @returns The source, or undefined when the field cannot resolve a credential.
 */
function readCredentialSource(value: object): CredentialSource | undefined {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, "credentialSource");
  } catch {
    return undefined;
  }
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    !isCredentialSource(descriptor.value)
  ) {
    return undefined;
  }
  return descriptor.value;
}

/**
 * Determines whether a value can resolve a credential.
 *
 * @param value Candidate credential source.
 * @returns Whether a function-valued getCredential data property is visible.
 */
function isCredentialSource(value: unknown): value is CredentialSource {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  let current: object | null = value;
  while (current !== null) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(current, "getCredential");
    } catch {
      return false;
    }
    if (descriptor !== undefined) {
      return "value" in descriptor && typeof descriptor.value === "function";
    }
    try {
      current = Object.getPrototypeOf(current);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Copies a request and appends one header occurrence.
 *
 * @param request Request to copy.
 * @param name Header name to append.
 * @param value Header value to append.
 * @returns A new frozen request. Body bytes keep their original identity.
 */
function appendHeader(request: TransportRequest, name: string, value: string): TransportRequest {
  return Object.freeze({
    method: request.method,
    url: Object.freeze({
      kind: request.url.kind,
      value: request.url.value,
    }),
    headers: Object.freeze([
      ...request.headers.map((header) =>
        Object.freeze({
          name: header.name,
          value: header.value,
        }),
      ),
      Object.freeze({ name, value }),
    ]),
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

/** Creates the failure for an aborted Bearer authorization attempt. */
function createCancelledAuthorizationError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Authorization was cancelled.",
    category: "cancelled",
    phase: "authorization",
    code: CANCELLED_AUTHORIZATION_CODE,
    diagnostics: [],
  });
}

/** Creates the failure for a description this handler does not support. */
function createUnsupportedAuthorizationError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "The Bearer handler does not support the supplied authorization.",
    category: "authentication",
    phase: "authorization",
    code: UNSUPPORTED_AUTHORIZATION_CODE,
    diagnostics: [],
  });
}

/**
 * Creates the failure for a credential that cannot form one Bearer field.
 *
 * @returns An error that does not include the credential text.
 */
function createUnsafeAuthorizationHeaderError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Bearer credential cannot be written as one header field.",
    category: "authentication",
    phase: "authorization",
    code: UNSAFE_AUTHORIZATION_HEADER_CODE,
    diagnostics: [],
  });
}
