// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type { HeaderFields } from "@evolutos/mconet-core-domain";

/**
 * Fetch forbidden request-header names, compared in lowercase.
 *
 * These names stay under user-agent control. `Set-Cookie` is included because
 * Fetch treats it as a request header the caller cannot set.
 */
const FORBIDDEN_REQUEST_HEADER_NAMES: ReadonlySet<string> = new Set([
  "accept-charset",
  "accept-encoding",
  "access-control-request-headers",
  "access-control-request-method",
  "connection",
  "content-length",
  "cookie",
  "cookie2",
  "date",
  "dnt",
  "expect",
  "host",
  "keep-alive",
  "origin",
  "referer",
  "set-cookie",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "via",
]);

/** Names whose value can smuggle a forbidden method. */
const METHOD_OVERRIDE_HEADER_NAMES: ReadonlySet<string> = new Set([
  "x-http-method",
  "x-http-method-override",
  "x-method-override",
]);

/** Methods Fetch forbids, compared in lowercase. */
const FORBIDDEN_METHODS: ReadonlySet<string> = new Set(["connect", "trace", "track"]);

/** Stable code for a header the browser transport must not pass to Fetch. */
const FORBIDDEN_REQUEST_HEADER_CODE = "forbidden_request_header";

/**
 * Rejects request headers the browser Fetch implementation would drop or ignore.
 *
 * The check covers the fixed forbidden names, the `proxy-` and `sec-` prefixes,
 * and method-override headers whose value names `CONNECT`, `TRACE`, or `TRACK`.
 * It does not call Fetch. A failure does not include the header name or value.
 *
 * @param headers Ordered request header occurrences.
 */
export function assertBrowserRequestHeaders(headers: HeaderFields): void {
  for (const header of headers) {
    if (isForbiddenBrowserRequestHeader(header.name, header.value)) {
      throw createForbiddenRequestHeaderError();
    }
  }
}

/**
 * Applies the Fetch forbidden request-header rules to one occurrence.
 *
 * @param name Header name, compared without case folding the stored value.
 * @param value Header value, inspected only for method-override names.
 * @returns Whether Fetch would reject this occurrence.
 */
function isForbiddenBrowserRequestHeader(name: string, value: string): boolean {
  const normalizedName = name.toLowerCase();

  if (
    FORBIDDEN_REQUEST_HEADER_NAMES.has(normalizedName) ||
    normalizedName.startsWith("proxy-") ||
    normalizedName.startsWith("sec-")
  ) {
    return true;
  }

  if (!METHOD_OVERRIDE_HEADER_NAMES.has(normalizedName)) {
    return false;
  }

  return value.split(",").some((method) => FORBIDDEN_METHODS.has(method.trim().toLowerCase()));
}

/**
 * Creates the error for a forbidden request header.
 *
 * @returns Request error that does not include the header name or value.
 */
function createForbiddenRequestHeaderError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Browser Fetch rejected a forbidden request header.",
    category: "invalid_request",
    phase: "transport",
    code: FORBIDDEN_REQUEST_HEADER_CODE,
    diagnostics: [],
  });
}
