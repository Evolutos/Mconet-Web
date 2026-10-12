// Copyright © 2026 Mcont.

import type { InteractionMode, ModelTarget, TaskDescriptor } from "@evolutos/mconet-core-domain";
import type { ModelIntegrationPlan, TaskProtocolAdapter } from "@evolutos/mconet-core-spi";

import { createDirectModelIntegrationPlan } from "./create-direct-model-integration-plan.js";

/**
 * Schedules the direct-adapter integration branch.
 *
 * A supplied adapter is checked once and becomes a direct plan. No resolver,
 * binding, or transport is consulted. An absent adapter returns `undefined` so
 * the resolver branch can run later.
 *
 * @param input Optional adapter and the tuple it must support.
 * @returns The direct plan, or `undefined` when no adapter was injected.
 * @throws {ModelInteractionError} When the adapter rejects the tuple.
 */
export function scheduleDirectAdapterBranch(input: {
  readonly adapter?: TaskProtocolAdapter;
  readonly target: ModelTarget;
  readonly task: TaskDescriptor;
  readonly mode: InteractionMode;
}): ModelIntegrationPlan | undefined {
  if (input.adapter === undefined) {
    // Absence is not a failure. The resolver branch owns that case.
    return undefined;
  }
  return createDirectModelIntegrationPlan({
    adapter: input.adapter,
    target: input.target,
    task: input.task,
    mode: input.mode,
  });
}
