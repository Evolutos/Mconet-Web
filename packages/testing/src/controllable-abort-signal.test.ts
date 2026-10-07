// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import { ControllableAbortSignal } from "./controllable-abort-signal.js";

it("exposes one stable signal and one optional-reason trigger", () => {
  // The public surface contains no controller, timer, reset, or state mutation
  // beyond the precise cancellation action needed by tests.
  expectTypeOf<ControllableAbortSignal["signal"]>().toEqualTypeOf<AbortSignal>();
  expectTypeOf<ControllableAbortSignal["abort"]>().toEqualTypeOf<(reason?: unknown) => void>();
  expectTypeOf<typeof ControllableAbortSignal>().constructorParameters.toEqualTypeOf<[]>();
});

it("starts active with one stable AbortSignal identity", () => {
  const harness = new ControllableAbortSignal();

  // Construction performs no implicit cancellation or listener registration.
  expect(harness.signal.aborted).toBe(false);
  expect(harness.signal.reason).toBeUndefined();
  expect(harness.signal).toBe(harness.signal);
});

it("supports pre-cancellation with the exact reason", () => {
  const harness = new ControllableAbortSignal();
  const reason = { source: "pre-cancelled fixture" };

  harness.abort(reason);

  // A consumer receiving the signal after this point observes cancellation
  // synchronously and retains the caller's opaque reason object by identity.
  const consumerSignal = harness.signal;
  expect(consumerSignal.aborted).toBe(true);
  expect(consumerSignal.reason).toBe(reason);
  expect(() => consumerSignal.throwIfAborted()).toThrow(reason);
});

it("triggers an in-flight abort event synchronously", () => {
  const harness = new ControllableAbortSignal();
  const reason = new Error("business cancellation");
  const listener = vi.fn<() => void>();
  harness.signal.addEventListener("abort", listener, { once: true });

  harness.abort(reason);

  // Platform dispatch is synchronous: the listener and signal state are both
  // observable before abort returns to the test.
  expect(listener).toHaveBeenCalledOnce();
  expect(harness.signal.aborted).toBe(true);
  expect(harness.signal.reason).toBe(reason);
});

it("uses the standard AbortError when no reason is supplied", () => {
  const harness = new ControllableAbortSignal();

  harness.abort();

  // Delegating an omitted reason preserves native AbortController semantics
  // rather than inventing a testing-specific error category.
  expect(harness.signal.aborted).toBe(true);
  expect(harness.signal.reason).toBeInstanceOf(DOMException);
  expect(harness.signal.reason).toMatchObject({ name: "AbortError" });
});

it("keeps the first reason and dispatches only one event", () => {
  const harness = new ControllableAbortSignal();
  const listener = vi.fn<() => void>();
  const firstReason = { sequence: 1 };
  const laterReason = { sequence: 2 };
  harness.signal.addEventListener("abort", listener);

  harness.abort(firstReason);
  harness.abort(laterReason);

  // Idempotence belongs to AbortController: repeated trigger calls cannot replace
  // the established reason or cause a second state transition.
  expect(listener).toHaveBeenCalledOnce();
  expect(harness.signal.reason).toBe(firstReason);
});

it("keeps cancellation isolated between harness instances", () => {
  const first = new ControllableAbortSignal();
  const second = new ControllableAbortSignal();

  first.abort("first only");

  // Every harness owns a distinct controller and signal; no module-level source
  // can leak cancellation into another test fixture.
  expect(first.signal).not.toBe(second.signal);
  expect(first.signal.aborted).toBe(true);
  expect(second.signal.aborted).toBe(false);
  expect(second.signal.reason).toBeUndefined();
});

it("prevents signal replacement and hides controller lifecycle controls", () => {
  const proveReadonly = (harness: ControllableAbortSignal, signal: AbortSignal): void => {
    // Compile-only assignment verifies that consumers cannot redirect the
    // harness to a different signal identity.
    // @ts-expect-error The exposed signal identity is immutable.
    harness.signal = signal;
  };

  // Tests can trigger cancellation but cannot reset or access the private source.
  expectTypeOf(proveReadonly).toBeFunction();
  expectTypeOf<ControllableAbortSignal>().not.toHaveProperty("controller");
  expectTypeOf<ControllableAbortSignal>().not.toHaveProperty("reset");
  expectTypeOf<ControllableAbortSignal>().not.toHaveProperty("setTimeout");
});
