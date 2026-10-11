// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

/** Stable code for an authorization header value that can inject another field. */
const INVALID_AUTHORIZATION_HEADER_VALUE_CODE = "invalid_authorization_header_value";

/** Line breaks that would terminate one header field and start another. */
const headerLineBreak = /[\r\n]/u;

/**
 * Rejects an authorization header value that contains a carriage return or line feed.
 *
 * Other characters, including spaces and colons, remain valid header-value text.
 * The function does not trim or rewrite the value. A failure does not echo it.
 *
 * @param value Header value that would be written onto a request.
 * @throws {ModelInteractionError} When the value contains CR or LF.
 */
export function validateAuthorizationHeaderValue(value: string): void {
  if (headerLineBreak.test(value)) {
    throw new ModelInteractionError({
      message: "Authorization header value contains a line break.",
      category: "authentication",
      phase: "authorization",
      code: INVALID_AUTHORIZATION_HEADER_VALUE_CODE,
      diagnostics: [
        {
          code: INVALID_AUTHORIZATION_HEADER_VALUE_CODE,
          severity: "error",
          phase: "authorization",
          message: "An authorization header value must stay inside one field.",
        },
      ],
    });
  }
}
