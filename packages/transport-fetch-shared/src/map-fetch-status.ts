// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type { TransportOutcome } from "@evolutos/mconet-core-spi";

/** Lowest status code in the HTTP response range. */
const MINIMUM_HTTP_STATUS = 100;

/** Highest status code in the HTTP response range. */
const MAXIMUM_HTTP_STATUS = 599;

/** Lowest 2xx status. */
const MINIMUM_SUCCESS_STATUS = 200;

/** Highest 2xx status. */
const MAXIMUM_SUCCESS_STATUS = 299;

/** Status Fetch reports for an opaque response that has no usable HTTP status. */
const OPAQUE_RESPONSE_STATUS = 0;

/** Stable code for a status that is not an HTTP or opaque Fetch status. */
const INVALID_FETCH_STATUS_CODE = "invalid_fetch_status";

/**
 * Maps one received Fetch status to a protocol-neutral transport outcome.
 *
 * A 2xx status is success. Every other HTTP status from 100 through 599 is a
 * service error, including 3xx, because this mapper does not follow redirects.
 * Status 0 is the opaque Fetch status and becomes a transport error. The
 * function does not read a body, headers, or media type.
 *
 * @param status HTTP status, or 0 for an opaque Fetch response.
 * @returns Outcome for `status`.
 * @throws {ModelInteractionError} When `status` is not an integer HTTP status or 0.
 */
export function mapFetchStatus(status: number): TransportOutcome {
  if (status === OPAQUE_RESPONSE_STATUS) {
    return "transport_error";
  }

  if (
    !Number.isSafeInteger(status) ||
    status < MINIMUM_HTTP_STATUS ||
    status > MAXIMUM_HTTP_STATUS
  ) {
    throw createInvalidFetchStatusError();
  }

  if (status >= MINIMUM_SUCCESS_STATUS && status <= MAXIMUM_SUCCESS_STATUS) {
    return "success";
  }

  return "service_error";
}

/**
 * Creates the failure for one status this mapper cannot classify.
 *
 * @returns Transport error that does not include the rejected status number.
 */
function createInvalidFetchStatusError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Fetch status is not an HTTP response status.",
    category: "protocol",
    phase: "transport",
    code: INVALID_FETCH_STATUS_CODE,
    diagnostics: [],
  });
}
