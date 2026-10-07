// Copyright © 2026 Mcont.

/**
 * Records exact component-call labels in synchronous observation order.
 *
 * Test doubles share one recorder and append a stable label when their public
 * operation is entered. Callers obtain frozen snapshots for assertions; the
 * mutable history, arguments, return values, timestamps, and reset controls are
 * intentionally not exposed.
 */
export class ComponentCallRecorder {
  /** Mutable history owned exclusively by this recorder instance. */
  readonly #calls: string[] = [];

  /**
   * Appends one exact non-empty call label.
   *
   * @param label Stable component-operation label selected by the test.
   * @throws {TypeError} When the label is not a string, is empty, or has surrounding whitespace.
   */
  public record(label: string): void {
    // Runtime validation protects JavaScript tests and preserves exact comparison
    // semantics; labels are rejected rather than silently trimmed or normalized.
    if (typeof label !== "string" || label.length === 0 || label.trim() !== label) {
      throw new TypeError(
        "Component call label must be non-empty and contain no surrounding whitespace.",
      );
    }

    // Array append preserves every invocation, including adjacent duplicates, in
    // the order synchronous component entry points reached this recorder.
    this.#calls.push(label);
  }

  /**
   * Returns a stable immutable copy of the recorded call sequence.
   *
   * @returns Frozen labels in their original observation order.
   */
  public snapshot(): readonly string[] {
    // Copy before freezing so later record calls cannot change a snapshot already
    // retained by an assertion and consumers cannot mutate internal history.
    return Object.freeze([...this.#calls]);
  }
}
