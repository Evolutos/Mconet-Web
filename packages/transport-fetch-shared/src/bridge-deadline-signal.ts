// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

/** Largest delay browsers and Node.js schedule without timer overflow. */
const MAXIMUM_TIMER_DELAY_MILLISECONDS = 2_147_483_647;

/** Stable timeout reason text shared by immediate and scheduled expiration. */
const DEADLINE_EXPIRED_MESSAGE = "The interaction deadline has expired.";

/** Platform exception name that distinguishes a deadline from caller cancellation. */
const TIMEOUT_ERROR_NAME = "TimeoutError";

/** Stable code for a deadline that is not a safe integer epoch millisecond. */
const INVALID_DEADLINE_CODE = "invalid_deadline";

/**
 * Fetch signal that aborts when an absolute deadline is reached.
 *
 * `stop` clears any pending timer. A deadline that already expired stays
 * aborted, and stopping does not change that reason.
 */
export interface DeadlineAbortBridge {
  /** Signal passed to Fetch and response reading. */
  readonly signal: AbortSignal;

  /**
   * Cancels a pending deadline check.
   *
   * The timer cannot fire after this returns. An already expired signal stays
   * aborted with its timeout reason.
   */
  stop(): void;
}

/**
 * Follows one absolute deadline with an explicit timeout reason.
 *
 * The deadline is Unix epoch milliseconds. A past or current deadline aborts
 * immediately. A future deadline is rechecked in bounded timer segments so a
 * long value cannot overflow a platform timer and fire early. The abort reason
 * is a `TimeoutError` DOMException, which is distinct from a caller-supplied
 * cancellation reason. Stopping the bridge drops the timer.
 *
 * @param deadline Signed safe integer milliseconds from the Unix epoch.
 * @returns Bridge whose signal aborts with a timeout reason at `deadline`.
 * @throws {ModelInteractionError} When `deadline` is not a safe integer.
 */
export function bridgeDeadlineSignal(deadline: number): DeadlineAbortBridge {
  if (!Number.isSafeInteger(deadline)) {
    throw createInvalidDeadlineError();
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  /**
   * Aborts once with the stable timeout reason.
   */
  function abortForDeadline(): void {
    controller.abort(new DOMException(DEADLINE_EXPIRED_MESSAGE, TIMEOUT_ERROR_NAME));
  }

  /**
   * Schedules the next absolute-time check, or aborts when the deadline has passed.
   */
  function scheduleDeadlineCheck(): void {
    if (stopped || controller.signal.aborted) {
      return;
    }

    const remainingMilliseconds = deadline - Date.now();
    if (remainingMilliseconds <= 0) {
      abortForDeadline();
      return;
    }

    const delayMilliseconds = Math.min(remainingMilliseconds, MAXIMUM_TIMER_DELAY_MILLISECONDS);
    timer = setTimeout(() => {
      timer = undefined;
      scheduleDeadlineCheck();
    }, delayMilliseconds);
  }

  if (deadline <= Date.now()) {
    abortForDeadline();
  } else {
    scheduleDeadlineCheck();
  }

  return {
    signal: controller.signal,
    stop(): void {
      stopped = true;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
  };
}

/**
 * Creates the failure for one deadline that cannot be scheduled.
 *
 * @returns Configuration error that does not include the rejected number.
 */
function createInvalidDeadlineError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Fetch deadline must be a safe integer epoch millisecond value.",
    category: "invalid_component_configuration",
    phase: "transport",
    code: INVALID_DEADLINE_CODE,
    diagnostics: [],
  });
}
