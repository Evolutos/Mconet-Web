// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { CodecContext } from "./codec-context.js";

it("defines only the codec operation cancellation lifecycle", () => {
  // Exact equality prevents unrelated request, transport, payload, or response
  // facts from expanding the authority available to encoder and decoder code.
  expectTypeOf<CodecContext>().toEqualTypeOf<{
    readonly signal: AbortSignal;
  }>();
});

it("preserves the interaction signal by identity", () => {
  const controller = new AbortController();
  const context: CodecContext = { signal: controller.signal };

  // The runtime passes its composed signal directly, so cancellation and
  // deadline state are observed without a second controller or timing policy.
  expect(context.signal).toBe(controller.signal);
  expect(context.signal.aborted).toBe(false);
  controller.abort("codec cancelled");
  expect(context.signal.aborted).toBe(true);
  expect(context.signal.reason).toBe("codec cancelled");
});

it("keeps the signal reference immutable", () => {
  const proveReadonly = (context: CodecContext): void => {
    // Exercise the forbidden write only during type checking; this helper is
    // retained but never invoked, so no live codec context can be mutated.
    // @ts-expect-error Codec lifecycle ownership remains with the runtime.
    context.signal = new AbortController().signal;
  };

  // Retain the compile-only helper so strict TypeScript validation enforces the
  // readonly property without executing the prohibited assignment.
  expectTypeOf(proveReadonly).toBeFunction();
});

it("does not expose payload transport authorization or response concerns", () => {
  // The erased value, codec descriptor, transport context, and runtime stages
  // provide these responsibilities through their own narrower boundaries.
  expectTypeOf<CodecContext>().not.toHaveProperty("value");
  expectTypeOf<CodecContext>().not.toHaveProperty("request");
  expectTypeOf<CodecContext>().not.toHaveProperty("response");
  expectTypeOf<CodecContext>().not.toHaveProperty("mediaType");
  expectTypeOf<CodecContext>().not.toHaveProperty("credential");
  expectTypeOf<CodecContext>().not.toHaveProperty("maxResponseBodyBytes");
});
