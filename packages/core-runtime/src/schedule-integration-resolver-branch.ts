// Copyright © 2026 Mcont.

import type {
  CompatibilityPolicy,
  InteractionMode,
  ModelTarget,
  TaskDescriptor,
} from "@evolutos/mconet-core-domain";
import type { ModelIntegrationPlan, ModelIntegrationResolver } from "@evolutos/mconet-core-spi";

/**
 * Schedules the integration-resolver branch.
 *
 * A supplied resolver is called once with the target, task, mode, and policy.
 * Its plan is returned unchanged. An absent resolver returns `undefined`. This
 * branch does not inject a direct adapter and does not call a transport.
 *
 * @param input Optional resolver and the labelled matching tuple.
 * @returns The resolver's plan, or `undefined` when no resolver was supplied.
 */
export function scheduleIntegrationResolverBranch(input: {
  readonly resolver?: ModelIntegrationResolver;
  readonly target: ModelTarget;
  readonly task: TaskDescriptor;
  readonly mode: InteractionMode;
  readonly policy: CompatibilityPolicy;
}): ModelIntegrationPlan | undefined {
  if (input.resolver === undefined) {
    // Absence is not a failure. The direct branch owns an injected adapter.
    return undefined;
  }
  return input.resolver.resolve({
    target: input.target,
    task: input.task,
    mode: input.mode,
    policy: input.policy,
  });
}
