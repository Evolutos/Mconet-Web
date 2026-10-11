// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

/**
 * Canonical HTTP methods this Fetch transport will send.
 *
 * The members are the methods Fetch normalizes to uppercase, plus PATCH, which
 * Fetch accepts unchanged. CONNECT, TRACE, and TRACK are absent because Fetch
 * rejects them. Any other token stays outside this reviewed surface, including
 * a different spelling of a listed method. Mapping does not rewrite case.
 */
export const FETCH_HTTP_METHOD = Object.freeze({
  delete: "DELETE",
  get: "GET",
  head: "HEAD",
  options: "OPTIONS",
  patch: "PATCH",
  post: "POST",
  put: "PUT",
} as const);

/** One method token accepted by {@link mapFetchHttpMethod}. */
export type FetchHttpMethod = (typeof FETCH_HTTP_METHOD)[keyof typeof FETCH_HTTP_METHOD];

/** Stable code for a method outside the Fetch transport whitelist. */
const UNSUPPORTED_HTTP_METHOD_CODE = "unsupported_http_method";

/** Lookup set for an exact whitelist match. */
const supportedFetchHttpMethods: ReadonlySet<string> = new Set(Object.values(FETCH_HTTP_METHOD));

/**
 * Accepts one canonical HTTP method for a Fetch request.
 *
 * The returned token is the input when it is an exact whitelist member. The
 * function does not trim, case-fold, or substitute another method, and it does
 * not read a URL, headers, body, credentials, or start a request.
 *
 * @param method Protocol method text to validate.
 * @returns The same method token, known to be Fetch-supported.
 * @throws {ModelInteractionError} When `method` is not an exact whitelist member.
 */
export function mapFetchHttpMethod(method: string): FetchHttpMethod {
  // Exact membership keeps the plan's method text unchanged. A case-folded or
  // trimmed token would hide a different value than the execution plan selected.
  if (!isFetchHttpMethod(method)) {
    throw createUnsupportedHttpMethodError();
  }

  return method;
}

/**
 * Narrows one string to a supported Fetch method token.
 *
 * @param method Candidate method text.
 * @returns Whether `method` is an exact whitelist member.
 */
function isFetchHttpMethod(method: string): method is FetchHttpMethod {
  return supportedFetchHttpMethods.has(method);
}

/**
 * Creates the content-safe failure for one unsupported method.
 *
 * The method text is omitted because an untrusted value could contain header
 * injection or other data that must not enter errors, diagnostics, or logs.
 *
 * @returns Transport error that does not include the rejected method.
 */
function createUnsupportedHttpMethodError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "HTTP method is not supported by the Fetch transport.",
    category: "invalid_request",
    phase: "transport",
    code: UNSUPPORTED_HTTP_METHOD_CODE,
    diagnostics: [],
  });
}
