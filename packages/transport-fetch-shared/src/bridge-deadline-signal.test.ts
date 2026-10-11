// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { bridgeDeadlineSignal } from "./bridge-deadline-signal.js";

/** Fixed epoch used so deadline transitions do not depend on the wall clock. */
const currentEpochMilliseconds = 1_800_000_000_000;

/** Platform timer ceiling covered by the segmented deadline check. */
const maximumTimerDelayMilliseconds = 2_147_483_647;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(currentEpochMilliseconds);
});

afterEach(() => {
  vi.useRealTimers();
});

it.each([
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  currentEpochMilliseconds + 0.5,
  Number.MAX_SAFE_INTEGER + 1,
])("rejects the unusable deadline %s", (deadline) => {
  expect(() => bridgeDeadlineSignal(deadline)).toThrow(ModelInteractionError);
  try {
    bridgeDeadlineSignal(deadline);
  } catch (error) {
    expect(error).toMatchObject({
      category: "invalid_component_configuration",
      phase: "transport",
      code: "invalid_deadline",
    });
    expect(String(error)).not.toContain(String(deadline));
  }
});

it("aborts immediately with a timeout reason when the deadline has arrived", () => {
  const bridge = bridgeDeadlineSignal(currentEpochMilliseconds);

  expect(bridge.signal.aborted).toBe(true);
  expect(bridge.signal.reason).toMatchObject({
    name: "TimeoutError",
    message: "The interaction deadline has expired.",
  });
  expect(vi.getTimerCount()).toBe(0);
});

it("aborts immediately when the deadline is in the past", () => {
  const bridge = bridgeDeadlineSignal(currentEpochMilliseconds - 1);

  expect(bridge.signal.aborted).toBe(true);
  expect(bridge.signal.reason).toMatchObject({ name: "TimeoutError" });
  expect(vi.getTimerCount()).toBe(0);
});

it("aborts with a timeout reason only when a future deadline is reached", async () => {
  const callerReason = { source: "caller" };
  const bridge = bridgeDeadlineSignal(currentEpochMilliseconds + 1_000);

  expect(bridge.signal.aborted).toBe(false);
  expect(bridge.signal.reason).not.toBe(callerReason);
  await vi.advanceTimersByTimeAsync(999);
  expect(bridge.signal.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(bridge.signal.aborted).toBe(true);
  expect(bridge.signal.reason).toMatchObject({
    name: "TimeoutError",
    message: "The interaction deadline has expired.",
  });
  expect(bridge.signal.reason).not.toBe(callerReason);
  expect(vi.getTimerCount()).toBe(0);
});

it("does not fire a deadline that extends past one platform timer", async () => {
  const bridge = bridgeDeadlineSignal(
    currentEpochMilliseconds + maximumTimerDelayMilliseconds + 100,
  );

  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(maximumTimerDelayMilliseconds);
  expect(bridge.signal.aborted).toBe(false);
  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(100);
  expect(bridge.signal.aborted).toBe(true);
  expect(bridge.signal.reason).toMatchObject({ name: "TimeoutError" });
});

it("does not abort after the deadline bridge stops", async () => {
  const bridge = bridgeDeadlineSignal(currentEpochMilliseconds + 1_000);

  bridge.stop();
  await vi.advanceTimersByTimeAsync(1_000);

  expect(bridge.signal.aborted).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps an expired timeout reason when the bridge stops", () => {
  const bridge = bridgeDeadlineSignal(currentEpochMilliseconds - 1);

  bridge.stop();

  expect(bridge.signal.aborted).toBe(true);
  expect(bridge.signal.reason).toMatchObject({ name: "TimeoutError" });
});
