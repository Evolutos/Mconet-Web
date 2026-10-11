// Copyright © 2026 Mcont.

import { ModelInteractionError, SecretValue } from "@evolutos/mconet-core-domain";
import type {
  AuthorizationContext,
  AuthorizationHandler,
  ComponentDescriptor,
  CredentialSource,
  TransportRequest,
} from "@evolutos/mconet-core-spi";

import {
  apiKeyHeaderAuthorizationKind,
  type ApiKeyHeaderAuthorization,
} from "./api-key-header-authorization.js";
import { validateAuthorizationHeaderName } from "./validate-authorization-header-name.js";

/** Diagnostic component name. It is not a registry key or selection identity. */
const API_KEY_HEADER_AUTHORIZATION_HANDLER_NAME = "api-key-header-authorization-handler";

/** Descriptive implementation version. It is not the package version. */
const API_KEY_HEADER_AUTHORIZATION_HANDLER_VERSION = "1.0.0";

/** Stable code for a description this handler cannot apply. */
const UNSUPPORTED_AUTHORIZATION_CODE = "unsupported_authorization";

/** Stable code for authorization stopped by the interaction signal. */
const CANCELLED_AUTHORIZATION_CODE = "cancelled";

/** Stable code for a header field that would inject another header. */
const UNSAFE_AUTHORIZATION_HEADER_CODE = "unsafe_authorization_header";

/** Line breaks that would split one header field into additional fields. */
const headerLineBreak = /[\r\n]/u;

/**
 * Metadata shared by every API-key header authorization handler.
 *
 * Name, version, and source are diagnostic facts. The handler provides no
 * selectable capability and has no codec port. This value does not register it.
 */
export const apiKeyHeaderAuthorizationHandlerDescriptor: ComponentDescriptor = {
  name: API_KEY_HEADER_AUTHORIZATION_HANDLER_NAME,
  version: API_KEY_HEADER_AUTHORIZATION_HANDLER_VERSION,
  capabilities: new Set(),
  source: "builtin",
};

/**
 * Adds one API-key header from a separate header name and credential source.
 *
 * Support matches only the API-key header scheme. Application reads the
 * credential once and appends one header occurrence. Existing method, URL,
 * headers, query, and body bytes are preserved. The credential is not written
 * anywhere except that new header value. Line breaks in the name or value fail
 * before a request is returned.
 */
export class ApiKeyHeaderAuthorizationHandler implements AuthorizationHandler {
  /** Shared descriptor for this builtin handler. */
  public readonly descriptor = apiKeyHeaderAuthorizationHandlerDescriptor;

  /**
   * Reports whether the description is an API-key header scheme.
   *
   * @param authorization Open authorization description to inspect.
   * @returns Whether the kind, header name, and credential source are present.
   */
  public supports(authorization: {
    readonly kind: string;
  }): authorization is ApiKeyHeaderAuthorization {
    // Read only own data fields. An accessor must not be treated as a header
    // name or invoked while deciding support.
    return (
      authorization.kind === apiKeyHeaderAuthorizationKind &&
      readOwnString(authorization, "headerName") !== undefined &&
      readCredentialSource(authorization) !== undefined
    );
  }

  /**
   * Appends the configured API-key header to a new request.
   *
   * @param input Encoded request, API-key description, and safe context.
   * @returns A request equal to the input plus one header occurrence.
   * @throws {ModelInteractionError} When the scheme, signal, or header field is unsafe.
   */
  public async apply(input: {
    readonly request: TransportRequest;
    readonly authorization: { readonly kind: string };
    readonly context: AuthorizationContext;
  }): Promise<TransportRequest> {
    if (input.context.signal.aborted) {
      throw createCancelledAuthorizationError();
    }
    if (!this.supports(input.authorization)) {
      throw createUnsupportedAuthorizationError();
    }

    const headerName = readOwnString(input.authorization, "headerName");
    const credentialSource = readCredentialSource(input.authorization);
    if (headerName === undefined || credentialSource === undefined) {
      throw createUnsupportedAuthorizationError();
    }
    validateAuthorizationHeaderName(headerName);

    const secret = await credentialSource.getCredential({ signal: input.context.signal });
    if (input.context.signal.aborted) {
      throw createCancelledAuthorizationError();
    }
    if (!(secret instanceof SecretValue)) {
      throw createUnsupportedAuthorizationError();
    }

    // Expose the credential only to copy it into the one new header value.
    // Validation failure must not place that text into the thrown error.
    const headerValue = secret.expose((value) => value);
    if (headerLineBreak.test(headerValue)) {
      throw createUnsafeAuthorizationHeaderError();
    }

    return appendHeader(input.request, headerName, headerValue);
  }
}

/**
 * Reads an own string data field without invoking an accessor.
 *
 * @param value Object to inspect.
 * @param key Field name to read.
 * @returns The string value, or undefined when the field is absent or not a string.
 */
function readOwnString(value: object, key: string): string | undefined {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    return undefined;
  }
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    typeof descriptor.value !== "string"
  ) {
    return undefined;
  }
  return descriptor.value;
}

/**
 * Reads an own credential source without calling it.
 *
 * @param value Authorization description to inspect.
 * @returns The source, or undefined when the field is not a credential source.
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
 * @returns Whether it exposes a function-valued getCredential data property.
 */
function isCredentialSource(value: unknown): value is CredentialSource {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  // Walk the prototype chain so a class method counts, while an accessor is
  // rejected instead of being invoked during support inspection.
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

/** Creates the failure for an aborted API-key authorization attempt. */
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
    message: "The API-key header handler does not support the supplied authorization.",
    category: "authentication",
    phase: "authorization",
    code: UNSUPPORTED_AUTHORIZATION_CODE,
    diagnostics: [],
  });
}

/**
 * Creates the failure for a header name or value that contains a line break.
 *
 * @returns An error that does not include the header name or credential.
 */
function createUnsafeAuthorizationHeaderError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Authorization header field contains a line break.",
    category: "authentication",
    phase: "authorization",
    code: UNSAFE_AUTHORIZATION_HEADER_CODE,
    diagnostics: [],
  });
}
