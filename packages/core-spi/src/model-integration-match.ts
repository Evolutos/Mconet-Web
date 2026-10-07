// Copyright © 2026 Mcont.

import type { ModelTargetMatch } from "./model-target-match.js";
import type { TaskMatch } from "./task-match.js";

/**
 * Immutable composition of one target match and one task execution match.
 *
 * Both nested outcomes retain their independent decisions, scores, diagnostics,
 * and identities. This value does not aggregate scores, merge observations,
 * infer overall applicability, or select an integration binding; those policies
 * remain owned by the deterministic model integration resolver.
 */
export interface ModelIntegrationMatch {
  /** Match facts for service, protocol, model, and deployment targeting. */
  readonly target: ModelTargetMatch;

  /** Match facts for the task descriptor and requested interaction mode. */
  readonly task: TaskMatch;
}
