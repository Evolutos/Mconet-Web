// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { TransportContext } from "./transport-context.js";

it("defines only immutable transport execution controls", () => {
  // Exact equality excludes requests, authorization, credentials, response
  // buffers, components, retries, and mutable client configuration.
  expectTypeOf<TransportContext>().toEqualTypeOf<{
    readonly signal: AbortSignal;
    readonly deadline?: number;
    readonly maxResponseBodyBytes: number;
  }>();
});

it("preserves the composed signal deadline and response limit", () => {
  const signal = new AbortController().signal;
  const context: TransportContext = {
    signal,
    deadline: 1_800_000_000_000,
    maxResponseBodyBytes: 8 * 1024 * 1024,
  };

  // Context data crosses the SPI boundary unchanged; this value neither creates
  // a timer nor derives another signal or byte limit.
  expect(context.signal).toBe(signal);
  expect(context.deadline).toBe(1_800_000_000_000);
  expect(context.maxResponseBodyBytes).toBe(8_388_608);
});

it("keeps deadline absent when no absolute limit was configured", () => {
  const context: TransportContext = {
    signal: new AbortController().signal,
    maxResponseBodyBytes: 1,
  };

  // Signal and response bound remain mandatory even without a deadline; the
  // interface does not invent Infinity, zero, or a platform timer sentinel.
  expect(Object.hasOwn(context, "deadline")).toBe(false);
  expect(context.deadline).toBeUndefined();
});

it("prevents transport controls from being replaced", () => {
  const proveReadonly = (context: TransportContext, signal: AbortSignal): void => {
    // This compile-only helper locks each control without executing mutations
    // against an active signal or request limit.
    // @ts-expect-error The authoritative cancellation signal cannot be replaced.
    context.signal = signal;
    // @ts-expect-error The absolute deadline cannot be replaced.
    context.deadline = 0;
    // @ts-expect-error The response body limit cannot be replaced.
    context.maxResponseBodyBytes = 0;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
