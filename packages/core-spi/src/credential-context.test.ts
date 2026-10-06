// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { CredentialContext } from "./credential-context.js";

it("defines only the immutable credential cancellation boundary", () => {
  // Exact equality prevents request, authorization, or secret state from
  // entering the credential provider contract through later incidental edits.
  expectTypeOf<CredentialContext>().toEqualTypeOf<{
    readonly signal: AbortSignal;
  }>();
});

it("propagates the owning interaction cancellation state", () => {
  const controller = new AbortController();
  const context: CredentialContext = {
    signal: controller.signal,
  };

  // The context retains the original platform signal instead of copying its
  // initial state, allowing an asynchronous provider to observe later aborts.
  expect(context.signal.aborted).toBe(false);
  controller.abort("interaction cancelled");
  expect(context.signal.aborted).toBe(true);
  expect(context.signal.reason).toBe("interaction cancelled");
});

it("prevents replacement of the interaction signal", () => {
  const proveReadonly = (context: CredentialContext): void => {
    // Exercise the forbidden write solely during type checking; this helper is
    // never invoked and therefore cannot mutate a runtime context instance.
    // @ts-expect-error Credential resolution must retain the owning interaction signal.
    context.signal = new AbortController().signal;
  };

  // Retain the helper in the compiled test so the readonly assertion remains
  // part of strict TypeScript validation without executing the assignment.
  expectTypeOf(proveReadonly).toBeFunction();
});
