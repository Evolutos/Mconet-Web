// Copyright © 2026 Mcont.

/** Largest delay that browsers and Node.js schedule without timer overflow. */
const maximumTimerDelayMilliseconds = 2_147_483_647;

/** Stable timeout reason text shared by immediate and scheduled expiration. */
const deadlineExpiredMessage = "The interaction deadline has expired.";

/**
 * Creates an AbortSignal that aborts when an absolute deadline is reached.
 *
 * The deadline is a signed safe integer containing Unix epoch milliseconds.
 * Expired deadlines return an already-aborted signal. Future deadlines are
 * checked against the wall clock in bounded timer segments so values beyond a
 * platform timer's native range never wrap or fire immediately.
 *
 * @param deadline Signed safe integer milliseconds from the Unix epoch.
 * @returns A new signal dedicated to this deadline.
 * @throws {TypeError} When the deadline is fractional, non-finite, or unsafe.
 */
export function createDeadlineSignal(deadline: number): AbortSignal {
  // Require the same exact millisecond representation used by other portable
  // time values; coercion, fractional precision, and unsafe integers are invalid.
  if (!Number.isSafeInteger(deadline)) {
    throw new TypeError("deadline must be a safe integer epoch millisecond value.");
  }

  const controller = new AbortController();

  // Expire synchronously when the wall clock has already reached the absolute
  // deadline, allowing callers to stop before credentials or I/O are touched.
  if (deadline <= Date.now()) {
    abortForExpiredDeadline(controller);
    return controller.signal;
  }

  // Schedule only after validating and checking the immediate path. The helper
  // retains the controller privately, exposing cancellation only via the signal.
  scheduleDeadlineCheck(controller, deadline);
  return controller.signal;
}

/** Schedules one bounded wall-clock check for a future absolute deadline. */
function scheduleDeadlineCheck(controller: AbortController, deadline: number): void {
  const remainingMilliseconds = deadline - Date.now();

  // Re-read the absolute clock after every segment so long deadlines and system
  // clock changes cannot make a stale relative duration authoritative.
  if (remainingMilliseconds <= 0) {
    abortForExpiredDeadline(controller);
    return;
  }

  const delayMilliseconds = Math.min(remainingMilliseconds, maximumTimerDelayMilliseconds);

  setTimeout(() => {
    // Continue with a fresh absolute-time calculation. The next call either
    // aborts at expiry or schedules another platform-safe segment.
    scheduleDeadlineCheck(controller, deadline);
  }, delayMilliseconds);
}

/** Aborts a deadline controller with the stable platform timeout reason. */
function abortForExpiredDeadline(controller: AbortController): void {
  // DOMException with the TimeoutError name follows AbortSignal.timeout and lets
  // later error normalization distinguish timeout from caller cancellation.
  controller.abort(new DOMException(deadlineExpiredMessage, "TimeoutError"));
}
