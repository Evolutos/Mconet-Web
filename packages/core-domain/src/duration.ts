// Copyright © 2026 Mcont.

/**
 * Non-negative elapsed time represented at whole-millisecond precision.
 *
 * Milliseconds provide one unit across browser and Node.js runtimes. Untrusted
 * values must pass the dedicated validator, which enforces non-negativity,
 * finiteness, integer precision, and the JSON safe-integer range.
 */
export interface Duration {
  /** Non-negative whole milliseconds; zero represents no elapsed time. */
  readonly milliseconds: number;
}
