// Copyright © 2026 Mcont.

import { afterEach, expect, it, vi } from "vitest";

import { resolveInteractionDeadline } from "./resolve-interaction-deadline.js";

afterEach(() => {
  vi.useRealTimers();
});

it("aborts when the deadline has already expired", () => {
  const caller = new AbortController();
  const resolved = resolveInteractionDeadline({
    signal: caller.signal,
    deadline: Date.now() - 1,
  });

  expect(resolved.aborted).toBe(true);
  expect(resolved.reason).toBeInstanceOf(DOMException);
  expect((resolved.reason as DOMException).name).toBe("TimeoutError");
});

it("propagates caller cancellation before a future deadline", () => {
  vi.useFakeTimers();
  vi.setSystemTime(1_800_000_000_000);
  const caller = new AbortController();
  const reason = new Error("caller cancelled");
  const resolved = resolveInteractionDeadline({
    signal: caller.signal,
    deadline: 1_800_000_000_000 + 60_000,
  });

  expect(resolved.aborted).toBe(false);
  caller.abort(reason);
  expect(resolved.aborted).toBe(true);
  expect(resolved.reason).toBe(reason);
});

it("returns the caller signal when no deadline was supplied", () => {
  const caller = new AbortController();
  const resolved = resolveInteractionDeadline({ signal: caller.signal });

  expect(resolved).toBe(caller.signal);
});
