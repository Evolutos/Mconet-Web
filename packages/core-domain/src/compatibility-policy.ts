// Copyright © 2026 Mcont.

import type { CompatibilityMode } from "./compatibility-mode.js";

/**
 * Immutable compatibility strategy selected for one interaction.
 *
 * The policy stores only the open mode identity. Processing components own the
 * behavior associated with standard or integration-defined modes; this data
 * contract does not introduce callbacks, mutable options, automatic fallback,
 * retry, or feature-specific fields that the initial Web runtime cannot use.
 */
export interface CompatibilityPolicy {
  /** Standard or integration-defined compatibility strategy identifier. */
  readonly mode: CompatibilityMode;
}
