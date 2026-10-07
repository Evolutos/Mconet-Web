// Copyright © 2026 Mcont.

import type { Diagnostic } from "@evolutos/mconet-core-domain";

/**
 * Immutable outcome of evaluating one integration against a model target.
 *
 * Matched is the explicit applicability decision. Score preserves matcher-owned
 * strength for later deterministic comparison without defining a global scale,
 * normalization rule, or tie breaker. Ordered diagnostics contain portable,
 * non-secret observations and do not retain the target, matcher, or component.
 */
export interface ModelTargetMatch {
  /** Whether the evaluated integration supports the model target. */
  readonly matched: boolean;

  /** Matcher-owned integer strength interpreted by the integration resolver. */
  readonly score: number;

  /** Ordered portable observations produced while matching the target. */
  readonly diagnostics: readonly Diagnostic[];
}
