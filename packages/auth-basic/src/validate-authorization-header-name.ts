// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

/** Stable code for an authorization header name that is not a field token. */
const INVALID_AUTHORIZATION_HEADER_NAME_CODE = "invalid_authorization_header_name";

/**
 * RFC 9110 field-name token restricted to the shared lowercase form.
 *
 * The character set matches service-access header names. Uppercase, spaces,
 * separators, and line breaks are rejected rather than normalized.
 */
const authorizationHeaderName = /^[!#$%&'*+\-.^_`|~0-9a-z]+$/u;

/**
 * Rejects an authorization header name that is not one lowercase field token.
 *
 * The function does not trim, lowercase, or otherwise rewrite the name. A
 * failure identifies the validation rule and does not echo the supplied name.
 *
 * @param name Header name selected by an authorization description.
 * @throws {ModelInteractionError} When the name contains an illegal character or is empty.
 */
export function validateAuthorizationHeaderName(name: string): void {
  if (!authorizationHeaderName.test(name)) {
    throw new ModelInteractionError({
      message: "Authorization header name contains an illegal character.",
      category: "authentication",
      phase: "authorization",
      code: INVALID_AUTHORIZATION_HEADER_NAME_CODE,
      diagnostics: [
        {
          code: INVALID_AUTHORIZATION_HEADER_NAME_CODE,
          severity: "error",
          phase: "authorization",
          message: "An authorization header name must be one lowercase field token.",
        },
      ],
    });
  }
}
