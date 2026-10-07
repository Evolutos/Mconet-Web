// Copyright © 2026 Mcont.

import {
  ModelInteractionError,
  type InteractionMode,
  type ModelTarget,
  type TaskDescriptor,
} from "@evolutos/mconet-core-domain";
import type { ModelIntegrationPlan, TaskProtocolAdapter } from "@evolutos/mconet-core-spi";

/**
 * Creates the minimal integration plan for an explicitly injected protocol adapter.
 *
 * The adapter is consulted exactly once with target, task, and interaction mode.
 * A supported adapter becomes the only integration-owned component in a direct
 * plan; every binding candidate collection remains empty. Unsupported adapters
 * fail immediately and never fall back to a resolver or lower-priority adapter.
 *
 * @param input Direct adapter and complete matching tuple for this interaction.
 * @returns A new shallow-frozen direct integration plan.
 * @throws {ModelInteractionError} When the adapter does not support the tuple.
 */
export function createDirectModelIntegrationPlan(
  input: Readonly<{
    readonly adapter: TaskProtocolAdapter;
    readonly target: ModelTarget;
    readonly task: TaskDescriptor;
    readonly mode: InteractionMode;
  }>,
): ModelIntegrationPlan {
  const supportsInput = {
    target: input.target,
    task: input.task,
    mode: input.mode,
  } as const;

  // Direct injection bypasses default integration lookup, not compatibility.
  // Call the same public support boundary once before constructing any plan.
  if (!input.adapter.supports(supportsInput)) {
    throw createUnsupportedDirectAdapterError(input.target, input.task, input.mode);
  }

  // Allocate separate frozen collections for each semantic role so later code
  // cannot append binding candidates or alias one role's candidate list to another.
  const authorizationHandlers = Object.freeze([]);
  const payloadEncoders = Object.freeze([]);
  const payloadDecoders = Object.freeze([]);
  const transports = Object.freeze([]);
  const extensions = Object.freeze({});

  // Binding provenance and defaults are absent by construction. Freezing only
  // the newly owned envelope preserves the injected adapter's original identity.
  return Object.freeze({
    source: "direct_adapter",
    taskProtocolAdapter: input.adapter,
    authorizationHandlers,
    payloadEncoders,
    payloadDecoders,
    transports,
    extensions,
  });
}

/** Creates the stable failure for a direct adapter that rejects the interaction tuple. */
function createUnsupportedDirectAdapterError(
  target: ModelTarget,
  task: TaskDescriptor,
  mode: InteractionMode,
): ModelInteractionError {
  // Matching identifiers are protocol metadata rather than credentials. Keep
  // them in JSON-safe diagnostic details while the technical message stays stable.
  return new ModelInteractionError({
    message: "The directly injected protocol adapter does not support this interaction.",
    category: "unsupported_feature",
    phase: "resolution",
    code: "unsupported_model_integration",
    diagnostics: [
      {
        code: "unsupported_model_integration",
        severity: "error",
        phase: "resolution",
        message: "The direct protocol adapter rejected the target, task, or mode.",
        serviceId: target.serviceId,
        details: {
          protocolId: target.protocolId,
          taskType: task.type,
          modeId: mode.id,
        },
      },
    ],
  });
}
