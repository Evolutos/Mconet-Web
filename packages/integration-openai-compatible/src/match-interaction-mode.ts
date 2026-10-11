// Copyright © 2026 Mcont.

import type { InteractionMode } from "@evolutos/mconet-core-domain";

/**
 * Interaction mode this integration handles.
 *
 * Matching uses this exact id. Streaming and long-running modes are not
 * rewritten into it.
 */
export const UNARY_INTERACTION_MODE_ID = "unary";

/**
 * Returns whether an interaction mode is the unary mode.
 *
 * Only `mode.id` is read. Comparison is exact and case-sensitive. A missing
 * mode does not match, and this function does not infer unary from the task
 * or the protocol.
 *
 * @param mode Interaction mode to test.
 * @returns Whether `mode.id` is `unary`.
 */
export function matchesUnaryInteractionMode(mode: InteractionMode): boolean {
  // A missing mode has no id to compare. Optional chaining keeps that false
  // without throwing from a supports check.
  return mode?.id === UNARY_INTERACTION_MODE_ID;
}
