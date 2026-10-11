// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { bridgeCallerAbortSignal } from "./bridge-caller-abort-signal.js";

it("preserves the reason when the caller is already aborted", () => {
  const reason = { source: "caller" };
  const caller = new AbortController();
  caller.abort(reason);

  const bridge = bridgeCallerAbortSignal(caller.signal);

  expect(bridge.signal.aborted).toBe(true);
  expect(bridge.signal.reason).toBe(reason);
  expect(caller.signal.aborted).toBe(true);
});

it("preserves the reason when the caller aborts later", () => {
  const reason = { source: "caller-later" };
  const caller = new AbortController();
  const bridge = bridgeCallerAbortSignal(caller.signal);

  expect(bridge.signal.aborted).toBe(false);
  caller.abort(reason);

  expect(bridge.signal.aborted).toBe(true);
  expect(bridge.signal.reason).toBe(reason);
  expect(caller.signal.reason).toBe(reason);
});

it("keeps the platform reason when the caller aborts without one", () => {
  const caller = new AbortController();
  const bridge = bridgeCallerAbortSignal(caller.signal);

  caller.abort();

  expect(bridge.signal.reason).toBe(caller.signal.reason);
});

it("does not abort the caller when the bridge is stopped", () => {
  const caller = new AbortController();
  const bridge = bridgeCallerAbortSignal(caller.signal);

  bridge.stop();

  expect(caller.signal.aborted).toBe(false);
  expect(bridge.signal.aborted).toBe(false);
});

it("ignores caller cancellation after the bridge stops", () => {
  const reason = { source: "after-stop" };
  const caller = new AbortController();
  const bridge = bridgeCallerAbortSignal(caller.signal);

  bridge.stop();
  caller.abort(reason);

  expect(bridge.signal.aborted).toBe(false);
  expect(caller.signal.reason).toBe(reason);
});

it("keeps an already aborted bridge stopped without clearing the reason", () => {
  const reason = { source: "already" };
  const caller = new AbortController();
  caller.abort(reason);
  const bridge = bridgeCallerAbortSignal(caller.signal);

  bridge.stop();

  expect(bridge.signal.aborted).toBe(true);
  expect(bridge.signal.reason).toBe(reason);
});
