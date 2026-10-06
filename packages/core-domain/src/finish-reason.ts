// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Protocol-reported reason that model generation stopped.
 *
 * The vocabulary remains fully open because services and protocol versions use
 * different reason sets. Core preserves the exact identity instead of imposing
 * a closed cross-provider enum or collapsing future values to `unknown`. Output
 * status, diagnostics, task result, and cancellation remain separate facts.
 */
export type FinishReason = OpenIdentifier;
