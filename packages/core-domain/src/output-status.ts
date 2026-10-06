// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Portable status identity for a parsed or assembled model output.
 *
 * The listed literals form the standard cross-task vocabulary. The open arm
 * preserves statuses introduced by integrations or future SDK versions without
 * collapsing them to `unknown`. Result data, stop reason, diagnostics, protocol
 * state, cancellation behavior, and error details remain separate contracts.
 */
export type OutputStatus =
  | "completed"
  | "requires_action"
  | "incomplete"
  | "refused"
  | "filtered"
  | "cancelled"
  | "failed"
  | "unknown"
  | (OpenIdentifier & Record<never, never>);
