// Copyright © 2026 Mcont.

/**
 * Fetch signal that follows a caller cancellation signal.
 *
 * Aborting the caller aborts this signal with the same reason object. Stopping
 * the bridge removes that subscription and does not abort either signal.
 */
export interface CallerAbortBridge {
  /** Signal passed to Fetch and response reading. */
  readonly signal: AbortSignal;

  /**
   * Stops following the caller.
   *
   * Later caller cancellation does not abort {@link signal}. A cancellation
   * that already happened remains in place.
   */
  stop(): void;
}

/**
 * Follows one caller signal without taking ownership of it.
 *
 * The bridged signal aborts with `caller.reason` by identity, including a
 * signal that is already aborted. The helper does not abort the caller, apply
 * a deadline, or convert the reason into a transport error.
 *
 * @param caller Caller's cancellation signal for this interaction.
 * @returns Bridge whose signal follows `caller` until `stop` is called.
 */
export function bridgeCallerAbortSignal(caller: AbortSignal): CallerAbortBridge {
  if (caller.aborted) {
    return {
      signal: AbortSignal.abort(caller.reason),
      stop(): void {
        // The caller already aborted, so there is no subscription to remove.
      },
    };
  }

  const controller = new AbortController();

  /**
   * Copies the caller's reason when the caller aborts.
   */
  function abortFromCaller(): void {
    controller.abort(caller.reason);
  }

  caller.addEventListener("abort", abortFromCaller, { once: true });

  return {
    signal: controller.signal,
    stop(): void {
      caller.removeEventListener("abort", abortFromCaller);
    },
  };
}
