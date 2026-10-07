// Copyright © 2026 Mcont.

import type { Diagnostic } from "@evolutos/mconet-core-domain";

/**
 * Immutable outcome of evaluating one integration against task execution.
 *
 * A matcher evaluates both the task descriptor and interaction mode before
 * producing this value. Matched records its explicit applicability decision,
 * score preserves matcher-owned strength for later deterministic comparison,
 * and ordered diagnostics explain the result without retaining matcher inputs.
 */
export interface TaskMatch {
  /** Whether the evaluated integration supports the task and mode pair. */
  readonly matched: boolean;

  /** Matcher-owned integer strength interpreted by the integration resolver. */
  readonly score: number;

  /** Ordered portable observations produced while matching task execution. */
  readonly diagnostics: readonly Diagnostic[];
}
