// Copyright © 2026 Mcont.

import type { Timestamp } from "@evolutos/mconet-core-domain";

import type { Clock } from "./clock.js";

/**
 * Manually advances a portable UTC instant for deterministic tests.
 *
 * The clock starts from one validated safe-integer Timestamp and moves only
 * forward by explicit whole-millisecond deltas. Every changed instant is a new
 * frozen snapshot, so prior observations remain stable. The class owns no timer,
 * wall-clock subscription, asynchronous task, reset path, or global state.
 */
export class FakeClock implements Clock {
  /** Current immutable instant snapshot owned by this clock instance. */
  #currentTime: Timestamp;

  /**
   * Creates an independently controlled clock at the supplied UTC instant.
   *
   * @param initialTime Initial whole-millisecond instant to copy.
   * @throws {RangeError} When the initial epoch value is not a safe integer.
   */
  public constructor(initialTime: Timestamp) {
    // Reject invalid direct structural values before the clock can publish them;
    // callers retain ownership and mutability of the supplied envelope.
    if (!Number.isSafeInteger(initialTime.epochMilliseconds)) {
      throw new RangeError("FakeClock initial time must be a safe integer millisecond value.");
    }

    // Copy and freeze only the clock-owned snapshot. This prevents later caller
    // mutation from changing the observed initial instant.
    this.#currentTime = Object.freeze({
      epochMilliseconds: initialTime.epochMilliseconds,
    });
  }

  /** Returns the current immutable instant snapshot. */
  public now(): Timestamp {
    // Reuse the snapshot until time changes, avoiding allocation while ensuring
    // callers can neither replace nor mutate private clock state.
    return this.#currentTime;
  }

  /**
   * Advances the current instant by a non-negative whole millisecond count.
   *
   * @param milliseconds Whole milliseconds to move forward.
   * @throws {RangeError} When the delta or resulting epoch is not a safe integer.
   */
  public advanceBy(milliseconds: number): void {
    // Advancing means moving forward only. Reject invalid deltas before reading a
    // prospective result so failures leave the current snapshot unchanged.
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
      throw new RangeError("FakeClock advance must be a non-negative safe integer.");
    }

    // Zero is a true no-op and retains snapshot identity for observers that use
    // identity to detect whether virtual time changed.
    if (milliseconds === 0) {
      return;
    }

    const nextEpochMilliseconds = this.#currentTime.epochMilliseconds + milliseconds;
    if (!Number.isSafeInteger(nextEpochMilliseconds)) {
      // Fail before assignment so overflow cannot corrupt the last valid instant.
      throw new RangeError("FakeClock advance exceeds the safe integer timestamp range.");
    }

    // Publish one new frozen snapshot atomically after every validation succeeds;
    // previously returned Timestamp objects therefore remain unchanged.
    this.#currentTime = Object.freeze({ epochMilliseconds: nextEpochMilliseconds });
  }
}
