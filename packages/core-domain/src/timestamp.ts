// Copyright © 2026 Mcont.

/**
 * UTC instant represented as signed whole milliseconds from the Unix epoch.
 *
 * Millisecond precision is shared by browser and Node.js runtimes and is safe
 * to serialize as a JSON number within the safe-integer range. Construction
 * from untrusted values must use the dedicated parser, which enforces finiteness,
 * integer precision, and range without exposing a mutable `Date` instance.
 */
export interface Timestamp {
  /** Signed whole milliseconds since 1970-01-01T00:00:00.000Z. */
  readonly epochMilliseconds: number;
}
