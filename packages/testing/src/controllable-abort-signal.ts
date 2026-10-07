// Copyright © 2026 Mcont.

/**
 * Exposes a test-owned AbortSignal whose cancellation can be triggered exactly.
 *
 * Consumers receive only the standard signal while a test controls the private
 * AbortController through {@link abort}. Triggering is synchronous, preserves the
 * supplied reason by identity, and inherits the platform's idempotent first-abort
 * semantics. The harness owns no timer, reset path, or production cancellation.
 */
export class ControllableAbortSignal {
  /** Private controller that alone can transition the exposed signal. */
  readonly #controller = new AbortController();

  /** Stable standard signal passed to the behavior under test. */
  public readonly signal: AbortSignal = this.#controller.signal;

  /**
   * Triggers cancellation synchronously with an optional caller-supplied reason.
   *
   * @param reason Exact reason to expose through `signal.reason`; omission uses
   * the platform's standard AbortError reason.
   */
  public abort(reason?: unknown): void {
    // Delegate exactly once per call. AbortController itself guarantees that the
    // first transition and reason win while later calls produce no new event.
    this.#controller.abort(reason);
  }
}
