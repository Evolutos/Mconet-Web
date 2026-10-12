// Copyright © 2026 Mcont.

import { composeAbortSignals } from "./compose-abort-signals.js";
import { createDeadlineSignal } from "./create-deadline-signal.js";

/**
 * Schedules deadline cancellation for one interaction.
 *
 * An absent deadline returns the caller signal unchanged, so no timer is
 * created. A present deadline is composed with that signal. An already expired
 * deadline aborts the result. Aborting the caller still aborts the result, and
 * an already-aborted caller keeps its reason ahead of the deadline.
 *
 * @param input Caller signal and the optional absolute deadline in epoch milliseconds.
 * @returns The signal later stages must observe.
 */
export function resolveInteractionDeadline(input: {
  readonly signal: AbortSignal;
  readonly deadline?: number;
}): AbortSignal {
  if (input.deadline === undefined) {
    // No deadline means no timeout source. Do not wrap the caller signal.
    return input.signal;
  }
  // The caller is the parent, so its existing abort wins over an expired deadline.
  return composeAbortSignals(input.signal, createDeadlineSignal(input.deadline));
}
