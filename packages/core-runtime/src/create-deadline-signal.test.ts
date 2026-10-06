// Copyright © 2026 Mcont.

import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { createDeadlineSignal } from "./create-deadline-signal.js";

const currentEpochMilliseconds = 1_800_000_000_000;
const maximumTimerDelayMilliseconds = 2_147_483_647;

describe("createDeadlineSignal", () => {
  beforeEach(() => {
    // Replace wall-clock and timer behavior so every deadline transition is
    // deterministic and no real timer survives a test boundary.
    vi.useFakeTimers();
    vi.setSystemTime(currentEpochMilliseconds);
  });

  afterEach(() => {
    // Restore platform time APIs even when an assertion fails, preventing this
    // suite from changing unrelated runtime tests.
    vi.useRealTimers();
  });

  it("defines the exact deadline conversion signature", () => {
    // The helper accepts one absolute millisecond value and exposes only the
    // standard cancellation signal rather than its private controller.
    expectTypeOf(createDeadlineSignal).parameters.toEqualTypeOf<[deadline: number]>();
    expectTypeOf(createDeadlineSignal).returns.toEqualTypeOf<AbortSignal>();
  });

  it("rejects non-finite, fractional, and unsafe deadlines", () => {
    const invalidDeadlines = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      currentEpochMilliseconds + 0.5,
      Number.MAX_SAFE_INTEGER + 1,
    ];

    // Validate every unsupported numeric representation through the same stable
    // diagnostic so Timer coercion can never decide public input semantics.
    for (const deadline of invalidDeadlines) {
      expect(() => {
        // Invoke only inside the throwing assertion boundary.
        createDeadlineSignal(deadline);
      }).toThrow("deadline must be a safe integer epoch millisecond value.");
    }
  });

  it("aborts synchronously when the deadline equals the current instant", () => {
    const signal = createDeadlineSignal(currentEpochMilliseconds);

    // Equality means no time remains; callers can observe timeout before starting
    // asynchronous work or yielding to the event loop.
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBeInstanceOf(DOMException);
    expect(signal.reason).toMatchObject({
      name: "TimeoutError",
      message: "The interaction deadline has expired.",
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts synchronously when the deadline is in the past", () => {
    const signal = createDeadlineSignal(currentEpochMilliseconds - 1);

    // A past signed epoch value is valid but already expired, so it shares the
    // immediate TimeoutError path without scheduling a zero-delay task.
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toMatchObject({ name: "TimeoutError" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("remains active until a future deadline is reached", async () => {
    const signal = createDeadlineSignal(currentEpochMilliseconds + 1_000);

    // Advance to the final millisecond boundary in two steps to prove the signal
    // cannot abort early and transitions exactly when no time remains.
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(999);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toMatchObject({
      name: "TimeoutError",
      message: "The interaction deadline has expired.",
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("splits deadlines beyond the native timer range", async () => {
    const signal = createDeadlineSignal(
      currentEpochMilliseconds + maximumTimerDelayMilliseconds + 100,
    );

    // The first maximum-length segment must only recheck the absolute clock;
    // the remaining interval is scheduled separately instead of overflowing.
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(maximumTimerDelayMilliseconds);
    expect(signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(99);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toMatchObject({ name: "TimeoutError" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses a separate signal for every deadline", () => {
    const first = createDeadlineSignal(currentEpochMilliseconds + 100);
    const second = createDeadlineSignal(currentEpochMilliseconds + 100);

    // Independent identities prevent one interaction from acquiring or
    // observing another interaction's private deadline controller.
    expect(first).not.toBe(second);
    expect(first.aborted).toBe(false);
    expect(second.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(2);
  });
});
