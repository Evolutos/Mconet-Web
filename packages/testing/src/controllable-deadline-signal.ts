// Copyright © 2026 Mcont.

/** Stable reason text matching the Runtime deadline signal contract. */
const deadlineExpiredMessage = "The interaction deadline has expired.";

/**
 * Exposes a test-owned AbortSignal whose deadline can expire on demand.
 *
 * Tests call {@link expire} at an exact execution point without using a wall
 * clock or timer. Expiration aborts synchronously with the same standard
 * TimeoutError shape as the Runtime deadline helper. The first expiration wins;
 * this harness has no absolute deadline, arbitrary reason, reset, or scheduler.
 */
export class ControllableDeadlineSignal {
  /** Private controller that alone can transition the deadline signal. */
  readonly #controller = new AbortController();

  /** Stable standard signal passed to the behavior under test. */
  public readonly signal: AbortSignal = this.#controller.signal;

  /** Expires the deadline synchronously with the stable TimeoutError reason. */
  public expire(): void {
    // Allocate the reason only at the requested trigger point. AbortController
    // preserves the first reason and ignores repeated expiration transitions.
    this.#controller.abort(new DOMException(deadlineExpiredMessage, "TimeoutError"));
  }
}
