// Copyright © 2026 Mcont.

import {
  ModelInteractionError,
  type CompatibilityPolicy,
  type InteractionMode,
  type ModelTarget,
  type TaskDescriptor,
} from "@evolutos/mconet-core-domain";
import type {
  ModelIntegrationPlan,
  ModelIntegrationResolver,
  TaskProtocolAdapter,
} from "@evolutos/mconet-core-spi";

import { scheduleDirectAdapterBranch } from "./schedule-direct-adapter-branch.js";
import { scheduleIntegrationResolverBranch } from "./schedule-integration-resolver-branch.js";

/** Stable code when neither an adapter nor a resolver was supplied. */
const missingIntegrationCode = "missing_model_integration";

/**
 * Joins the direct-adapter and resolver branches into one plan.
 *
 * An injected adapter wins and the resolver is not called. Otherwise the
 * resolver is called once. The caller receives only a {@link ModelIntegrationPlan};
 * later stages do not choose between the branches again. Supplying neither
 * source fails with a stable missing-integration error.
 *
 * @param input Adapter, resolver, and the matching tuple.
 * @returns The single plan selected for this interaction.
 * @throws {ModelInteractionError} When both the adapter and the resolver are absent,
 * or when the selected branch rejects the tuple.
 */
export function joinIntegrationBranches(input: {
  readonly adapter?: TaskProtocolAdapter;
  readonly resolver?: ModelIntegrationResolver;
  readonly target: ModelTarget;
  readonly task: TaskDescriptor;
  readonly mode: InteractionMode;
  readonly policy: CompatibilityPolicy;
}): ModelIntegrationPlan {
  if (input.adapter !== undefined) {
    const direct = scheduleDirectAdapterBranch(input);
    if (direct === undefined) {
      // A supplied adapter either yields a plan or throws from the direct branch.
      throw new Error("The direct adapter branch returned no plan for a supplied adapter.");
    }
    // The resolver is intentionally not called once a direct plan exists.
    return direct;
  }

  const resolved = scheduleIntegrationResolverBranch(input);
  if (resolved !== undefined) {
    return resolved;
  }

  throw new ModelInteractionError({
    message: "An interaction requires a protocol adapter or an integration resolver.",
    category: "invalid_component_configuration",
    phase: "resolution",
    code: missingIntegrationCode,
    diagnostics: [
      {
        code: missingIntegrationCode,
        severity: "error",
        phase: "resolution",
        message: "Neither a direct adapter nor an integration resolver was supplied.",
      },
    ],
  });
}
