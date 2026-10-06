// Copyright © 2026 Mcont.

/**
 * Composes optional parent and child cancellation sources into one new signal.
 *
 * An already-aborted parent has deterministic priority over an already-aborted
 * child. Otherwise the first source to abort wins and its reason is propagated
 * unchanged. Composition delegates dependency lifetime and deduplication to the
 * standard platform algorithm instead of installing manually retained event
 * listeners. Passing the same signal twice contributes only one source.
 *
 * @param parentSignal Optional higher-level cancellation source.
 * @param childSignal Optional interaction-local or deadline cancellation source.
 * @returns A distinct signal reflecting the first applicable upstream abort.
 */
export function composeAbortSignals(
  parentSignal: AbortSignal | undefined,
  childSignal: AbortSignal | undefined,
): AbortSignal {
  const sourceSignals: AbortSignal[] = [];

  // Preserve parent-first iterable order for deterministic pre-aborted priority,
  // omit absent inputs, and avoid contributing the same signal twice.
  if (parentSignal !== undefined) {
    sourceSignals.push(parentSignal);
  }
  if (childSignal !== undefined && childSignal !== parentSignal) {
    sourceSignals.push(childSignal);
  }

  // The platform composition algorithm returns a distinct signal, propagates
  // only its first dependency reason, and manages dependency lifetime without a
  // permanently attached JavaScript listener owned by this helper.
  return AbortSignal.any(sourceSignals);
}
