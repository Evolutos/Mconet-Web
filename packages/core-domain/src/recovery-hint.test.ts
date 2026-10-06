// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { RecoveryHint } from "./recovery-hint.js";

it("defines three optional readonly recovery facts", () => {
  expectTypeOf<RecoveryHint>().toEqualTypeOf<{
    readonly transient?: boolean;
    readonly retryAfterMilliseconds?: number;
    readonly requestMayHaveBeenProcessed?: boolean;
  }>();
});

it("distinguishes absent facts from explicit false and zero values", () => {
  const unknownRecovery: RecoveryHint = {};
  const knownRecovery: RecoveryHint = {
    transient: false,
    retryAfterMilliseconds: 0,
    requestMayHaveBeenProcessed: false,
  };

  expect(unknownRecovery).toEqual({});
  expect(knownRecovery).toEqual({
    transient: false,
    retryAfterMilliseconds: 0,
    requestMayHaveBeenProcessed: false,
  });
});

it("allows each recovery fact to be reported independently", () => {
  const hints: readonly RecoveryHint[] = [
    { transient: true },
    { retryAfterMilliseconds: 2_000 },
    { requestMayHaveBeenProcessed: true },
  ];

  expect(hints).toEqual([
    { transient: true },
    { retryAfterMilliseconds: 2_000 },
    { requestMayHaveBeenProcessed: true },
  ]);
});

it("prevents recovery facts from being replaced at compile time", () => {
  const proveReadonly = (hint: RecoveryHint): void => {
    // Exercise every property assignment only for compile-time verification;
    // the helper is intentionally not invoked and therefore mutates no fixture.
    // @ts-expect-error Recovery facts are immutable after construction.
    hint.transient = true;
    // @ts-expect-error The suggested delay cannot be replaced.
    hint.retryAfterMilliseconds = 1_000;
    // @ts-expect-error Request processing uncertainty cannot be rewritten.
    hint.requestMayHaveBeenProcessed = false;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
