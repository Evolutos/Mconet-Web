// Copyright © 2026 Mcont.

import type { InteractionExecutionComponents } from "@evolutos/mconet-core-spi";

/**
 * Creates the immutable component snapshot used by one unary interaction.
 *
 * Every input is already selected and validated by an earlier Runtime stage.
 * The factory preserves those object identities, copies the only candidate list
 * whose membership must be isolated from caller mutation, and shallow-freezes the
 * new envelope. It does not repeat selection, inspect descriptors, call component
 * behavior, freeze caller-owned implementations, or perform lifecycle actions.
 *
 * @param input Complete validated execution components and resolution facts.
 * @returns A new shallow-frozen per-interaction component snapshot.
 */
export function createInteractionExecutionComponents(
  input: InteractionExecutionComponents,
): InteractionExecutionComponents {
  // Snapshot handler membership because configuration layers may retain mutable
  // source arrays even though the public SPI exposes a readonly view.
  const authorizationHandlers = Object.freeze([...input.authorizationHandlers]);

  // Retain exact validated identities for every single-value component and fact.
  // Freezing the owned envelope prevents in-flight replacement without taking
  // ownership of injected implementations or previously resolved snapshots.
  return Object.freeze({
    integrationPlan: input.integrationPlan,
    componentSelection: input.componentSelection,
    resourceLimits: input.resourceLimits,
    taskProtocolAdapter: input.taskProtocolAdapter,
    serviceAccessResolver: input.serviceAccessResolver,
    payloadEncoder: input.payloadEncoder,
    successPayloadDecoder: input.successPayloadDecoder,
    errorPayloadDecoder: input.errorPayloadDecoder,
    transport: input.transport,
    authorizationHandlerResolver: input.authorizationHandlerResolver,
    authorizationHandlers,
    capabilityResolution: input.capabilityResolution,
  });
}
