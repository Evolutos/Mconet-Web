// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import { ControllableDeadlineSignal } from "./controllable-deadline-signal.js";

it("exposes one stable signal and one zero-argument expiration trigger", () => {
  // The harness provides only the exact inputs needed for deterministic timeout
  // tests and does not accept an arbitrary reason or deadline configuration.
  expectTypeOf<ControllableDeadlineSignal["signal"]>().toEqualTypeOf<AbortSignal>();
  expectTypeOf<ControllableDeadlineSignal["expire"]>().toEqualTypeOf<() => void>();
  expectTypeOf<typeof ControllableDeadlineSignal>().constructorParameters.toEqualTypeOf<[]>();
});

it("starts active with a stable signal identity", () => {
  const harness = new ControllableDeadlineSignal();

  // Construction schedules nothing and leaves the deadline active until the
  // test explicitly selects the expiration point.
  expect(harness.signal.aborted).toBe(false);
  expect(harness.signal.reason).toBeUndefined();
  expect(harness.signal).toBe(harness.signal);
});

it("supports expiration before a consumer receives the signal", () => {
  const harness = new ControllableDeadlineSignal();

  harness.expire();

  // A later consumer observes the exact pre-expired state synchronously without
  // advancing fake or real time.
  const consumerSignal = harness.signal;
  expect(consumerSignal.aborted).toBe(true);
  expect(consumerSignal.reason).toBeInstanceOf(DOMException);
  expect(consumerSignal.reason).toMatchObject({
    name: "TimeoutError",
    message: "The interaction deadline has expired.",
  });
  expect(() => consumerSignal.throwIfAborted()).toThrow(consumerSignal.reason);
});

it("triggers an in-flight timeout event synchronously", () => {
  const harness = new ControllableDeadlineSignal();
  const listener = vi.fn<() => void>();
  harness.signal.addEventListener("abort", listener, { once: true });

  harness.expire();

  // Expiration is visible before expire returns, making an exact execution-stage
  // assertion possible without yielding to a timer queue.
  expect(listener).toHaveBeenCalledOnce();
  expect(harness.signal.aborted).toBe(true);
  expect(harness.signal.reason).toMatchObject({ name: "TimeoutError" });
});

it("keeps the first timeout reason and dispatches only once", () => {
  const harness = new ControllableDeadlineSignal();
  const listener = vi.fn<() => void>();
  harness.signal.addEventListener("abort", listener);

  harness.expire();
  const firstReason = harness.signal.reason;
  harness.expire();

  // The second call may allocate an unused DOMException internally, but platform
  // idempotence retains the first published reason and single transition event.
  expect(listener).toHaveBeenCalledOnce();
  expect(harness.signal.reason).toBe(firstReason);
});

it("keeps expiration isolated between harness instances", () => {
  const first = new ControllableDeadlineSignal();
  const second = new ControllableDeadlineSignal();

  first.expire();

  // Independent controllers ensure one simulated timeout cannot leak into a
  // concurrent or subsequent test fixture.
  expect(first.signal).not.toBe(second.signal);
  expect(first.signal.aborted).toBe(true);
  expect(second.signal.aborted).toBe(false);
  expect(second.signal.reason).toBeUndefined();
});

it("prevents signal replacement and exposes no clock timer or reset controls", () => {
  const proveReadonly = (harness: ControllableDeadlineSignal, signal: AbortSignal): void => {
    // Compile-only assignment locks the signal identity passed to consumers.
    // @ts-expect-error The exposed deadline signal is immutable.
    harness.signal = signal;
  };

  // Actual scheduling and absolute deadline conversion remain production Runtime
  // concerns; this utility only supplies a manual timeout transition.
  expectTypeOf(proveReadonly).toBeFunction();
  expectTypeOf<ControllableDeadlineSignal>().not.toHaveProperty("abort");
  expectTypeOf<ControllableDeadlineSignal>().not.toHaveProperty("deadline");
  expectTypeOf<ControllableDeadlineSignal>().not.toHaveProperty("advanceBy");
  expectTypeOf<ControllableDeadlineSignal>().not.toHaveProperty("reset");
  expectTypeOf<ControllableDeadlineSignal>().not.toHaveProperty("setTimeout");
});
