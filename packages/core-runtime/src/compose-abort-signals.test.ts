// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it } from "vitest";

import { composeAbortSignals } from "./compose-abort-signals.js";

describe("composeAbortSignals", () => {
  // Exercise the exact signature, absence, initial state, both propagation
  // directions, first-winner behavior, source isolation, and source deduplication.
  it("defines the exact parent-child composition signature", () => {
    // Both sources are explicit optional-valued arguments; implementation
    // details of the platform-created dependent signal stay outside the API.
    expectTypeOf(composeAbortSignals).parameters.toEqualTypeOf<
      [parentSignal: AbortSignal | undefined, childSignal: AbortSignal | undefined]
    >();
    expectTypeOf(composeAbortSignals).returns.toEqualTypeOf<AbortSignal>();
  });

  it("returns a distinct active signal when both sources are absent", () => {
    const first = composeAbortSignals(undefined, undefined);
    const second = composeAbortSignals(undefined, undefined);

    // Independent active identities provide a stable signal to downstream code
    // without inventing an upstream cancellation source.
    expect(first.aborted).toBe(false);
    expect(second.aborted).toBe(false);
    expect(first).not.toBe(second);
  });

  it("propagates an already-aborted parent synchronously", () => {
    const reason = { source: "parent" };
    const parent = AbortSignal.abort(reason);
    const child = new AbortController().signal;

    const result = composeAbortSignals(parent, child);

    // Composition reflects the initial state synchronously and retains the
    // caller's arbitrary reason object by identity.
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe(reason);
  });

  it("propagates an already-aborted child synchronously", () => {
    const reason = new DOMException("deadline", "TimeoutError");
    const parent = new AbortController().signal;
    const child = AbortSignal.abort(reason);

    const result = composeAbortSignals(parent, child);

    // An active parent does not mask a child that was already cancelled.
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe(reason);
  });

  it("gives the parent deterministic priority when both sources are aborted", () => {
    const parentReason = { source: "parent" };
    const childReason = { source: "child" };
    const result = composeAbortSignals(
      AbortSignal.abort(parentReason),
      AbortSignal.abort(childReason),
    );

    // Argument order, not engine event ordering, resolves the simultaneous
    // pre-aborted state.
    expect(result.reason).toBe(parentReason);
  });

  it("propagates a later parent abort with its exact reason", () => {
    const parent = new AbortController();
    const child = new AbortController();
    const reason = new Error("caller cancelled");
    const result = composeAbortSignals(parent.signal, child.signal);

    // The result remains active until the parent abort event occurs.
    expect(result.aborted).toBe(false);
    parent.abort(reason);
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe(reason);
    expect(child.signal.aborted).toBe(false);
  });

  it("propagates a later child abort with its exact reason", () => {
    const parent = new AbortController();
    const child = new AbortController();
    const reason = new DOMException("deadline", "TimeoutError");
    const result = composeAbortSignals(parent.signal, child.signal);

    // Child cancellation follows the same identity-preserving path as parent
    // cancellation and does not require the parent to change state.
    child.abort(reason);
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe(reason);
    expect(parent.signal.aborted).toBe(false);
  });

  it("keeps the first runtime abort reason when the other source aborts later", () => {
    const parent = new AbortController();
    const child = new AbortController();
    const childReason = { source: "child" };
    const parentReason = { source: "parent" };
    const result = composeAbortSignals(parent.signal, child.signal);

    // The child wins first; a later parent abort cannot replace the result reason
    // or trigger another result transition.
    child.abort(childReason);
    parent.abort(parentReason);
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe(childReason);
  });

  it("composes a repeated source only once without returning that source", () => {
    const source = new AbortController();
    const reason = { source: "shared" };
    const result = composeAbortSignals(source.signal, source.signal);

    // Deduplication still returns a distinct dependent signal and preserves the
    // sole source's reason when it later aborts.
    expect(result).not.toBe(source.signal);
    source.abort(reason);
    expect(result.reason).toBe(reason);
  });
});
