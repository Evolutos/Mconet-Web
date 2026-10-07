// Copyright © 2026 Mcont.

import type {
  CompatibilityPolicy,
  InteractionMode,
  ModelTarget,
  TaskDescriptor,
} from "@evolutos/mconet-core-domain";

import type { ModelIntegrationPlan } from "./model-integration-plan.js";
import type { RuntimeComponent } from "./runtime-component.js";

/**
 * Replaceable pure behavior that resolves one deterministic integration plan.
 *
 * Implementations inspect the complete target, task, interaction mode, and
 * compatibility policy using an immutable internal table, responsibility chain,
 * or equivalent private strategy. Resolution is synchronous and must not mutate
 * inputs, perform network I/O, read credentials, authorize a request, or expose
 * a business-writable binding registry or component-ID lookup mechanism.
 */
export interface ModelIntegrationResolver extends RuntimeComponent {
  /** Resolves the labelled matching tuple to one complete integration plan. */
  resolve(input: {
    readonly target: ModelTarget;
    readonly task: TaskDescriptor;
    readonly mode: InteractionMode;
    readonly policy: CompatibilityPolicy;
  }): ModelIntegrationPlan;
}
