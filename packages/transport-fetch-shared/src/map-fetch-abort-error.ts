// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

/** Platform exception name produced by the deadline bridge. */
const TIMEOUT_ERROR_NAME = "TimeoutError";

/** Stable code for caller cancellation. */
const CANCELLED_ERROR_CODE = "cancelled";

/** Stable code for a deadline timeout. */
const TIMEOUT_ERROR_CODE = "timeout";

/** Stable code for normalizing a signal that has not aborted. */
const INVALID_ABORT_STATE_CODE = "invalid_abort_state";

/**
 * Converts an aborted Fetch signal into a transport error.
 *
 * A `TimeoutError` reason becomes a timeout. Every other aborted signal becomes
 * caller cancellation. The public message is stable and does not include the
 * original reason, because that value can carry request details. The native
 * reason is not stored as `cause`.
 *
 * @param signal Signal observed when Fetch aborted.
 * @returns Timeout or cancellation error for `signal`.
 * @throws {ModelInteractionError} When `signal` is not aborted.
 */
export function mapFetchAbortError(signal: AbortSignal): ModelInteractionError {
  if (!signal.aborted) {
    throw createInvalidAbortStateError();
  }

  if (isTimeoutReason(signal.reason)) {
    return createTimeoutError();
  }

  return createCancelledError();
}

/**
 * Recognizes the deadline bridge reason without reading its message.
 *
 * @param reason Abort reason stored on the signal.
 * @returns Whether the reason is a platform timeout exception.
 */
function isTimeoutReason(reason: unknown): boolean {
  return reason instanceof DOMException && reason.name === TIMEOUT_ERROR_NAME;
}

/**
 * Creates the public timeout error.
 *
 * @returns Deadline failure with no native reason attached.
 */
function createTimeoutError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "The Fetch deadline expired.",
    category: "timeout",
    phase: "transport",
    code: TIMEOUT_ERROR_CODE,
    diagnostics: [],
  });
}

/**
 * Creates the public caller-cancellation error.
 *
 * @returns Cancellation failure with no caller reason attached.
 */
function createCancelledError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "The Fetch request was cancelled.",
    category: "cancelled",
    phase: "transport",
    code: CANCELLED_ERROR_CODE,
    diagnostics: [],
  });
}

/**
 * Creates the failure for normalizing a signal that is still active.
 *
 * @returns State error that does not include signal details.
 */
function createInvalidAbortStateError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Fetch abort normalization requires an aborted signal.",
    category: "protocol",
    phase: "transport",
    code: INVALID_ABORT_STATE_CODE,
    diagnostics: [],
  });
}
