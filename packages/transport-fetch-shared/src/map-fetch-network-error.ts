// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

/** Stage in which the platform reported a network failure. */
export type FetchNetworkFailureStage = "request" | "body";

/** Node and undici codes that mean the hostname could not be resolved. */
const DNS_ERROR_CODES: ReadonlySet<string> = new Set(["EAI_AGAIN", "ENOTFOUND"]);

/** Stable code for a DNS failure the platform identified. */
const DNS_ERROR_CODE = "dns_error";

/**
 * Stable code for a request failure whose platform error does not say whether
 * it was CORS, DNS, TLS, or connectivity.
 */
const NETWORK_ERROR_CODE = "network_error";

/** Stable code for a failure while reading the response body. */
const RESPONSE_BODY_READ_ERROR_CODE = "response_body_read_failed";

/**
 * Converts a platform network failure into a transport error.
 *
 * A body-stage failure is always a read failure. A request-stage failure is a
 * DNS error only when the platform exposes a DNS code. A bare `TypeError`,
 * including the browser failure used for CORS, DNS, TLS, and offline, stays an
 * unspecified network error. The public message does not include the native
 * message or the native error as `cause`.
 *
 * @param error Platform failure value.
 * @param stage Whether the failure happened before headers or while reading the body.
 * @returns Classified transport error for `error`.
 */
export function mapFetchNetworkError(
  error: unknown,
  stage: FetchNetworkFailureStage,
): ModelInteractionError {
  if (stage === "body") {
    return createResponseBodyReadError();
  }

  if (isDnsError(error)) {
    return createDnsError();
  }

  return createNetworkError();
}

/**
 * Looks for a platform DNS code without reading a message.
 *
 * @param error Platform failure value.
 * @returns Whether `error` or its direct cause exposes a DNS code.
 */
function isDnsError(error: unknown): boolean {
  return hasDnsCode(error) || hasDnsCode(readCause(error));
}

/**
 * Reads a DNS code from one error object.
 *
 * @param error Candidate error object.
 * @returns Whether its own `code` is a known DNS code.
 */
function hasDnsCode(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = Object.getOwnPropertyDescriptor(error, "code")?.value;
  return typeof code === "string" && DNS_ERROR_CODES.has(code);
}

/**
 * Reads an own cause without invoking an accessor.
 *
 * @param error Candidate error object.
 * @returns The cause value, or `undefined` when it is absent or unsafe to read.
 */
function readCause(error: unknown): unknown {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  try {
    const cause = Object.getOwnPropertyDescriptor(error, "cause");
    if (cause === undefined || !("value" in cause)) {
      return undefined;
    }
    return cause.value;
  } catch {
    return undefined;
  }
}

/**
 * Creates the public DNS error.
 *
 * @returns Network error that does not include the hostname.
 */
function createDnsError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Fetch could not resolve the host.",
    category: "network",
    phase: "transport",
    code: DNS_ERROR_CODE,
    diagnostics: [],
  });
}

/**
 * Creates the public unspecified network error.
 *
 * @returns Network error that does not claim a more specific platform cause.
 */
function createNetworkError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Fetch could not complete the request.",
    category: "network",
    phase: "transport",
    code: NETWORK_ERROR_CODE,
    diagnostics: [],
  });
}

/**
 * Creates the public response-body read error.
 *
 * @returns Read failure that does not include body bytes or the native message.
 */
function createResponseBodyReadError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Fetch could not read the response body.",
    category: "network",
    phase: "transport",
    code: RESPONSE_BODY_READ_ERROR_CODE,
    diagnostics: [],
  });
}
