// Copyright © 2026 Mcont.

import type { ResolvedInteractionResourceLimits } from "@evolutos/mconet-core-domain";

import type { AuthorizationHandler } from "./authorization-handler.js";
import type { AuthorizationHandlerResolver } from "./authorization-handler-resolver.js";
import type { CapabilityResolution } from "./capability-resolution.js";
import type { ComponentSelectionResolution } from "./component-selection-resolution.js";
import type { ModelIntegrationPlan } from "./model-integration-plan.js";
import type { PayloadDecoder } from "./payload-decoder.js";
import type { PayloadEncoder } from "./payload-encoder.js";
import type { ServiceAccessResolver } from "./service-access-resolver.js";
import type { TaskProtocolAdapter } from "./task-protocol-adapter.js";
import type { Transport } from "./transport.js";

/**
 * Immutable validated component snapshot for one unary interaction execution.
 *
 * Unlike optional configuration-layer overrides, every single-value component
 * required by the current request path is present. The snapshot is created only
 * after integration, component, type-contract, capability, and resource-limit
 * resolution succeed, so later stages never repeat selection or observe changes
 * to Client or integration defaults during an in-flight request.
 */
export interface InteractionExecutionComponents {
  /** Integration provenance and candidate components fixed for this interaction. */
  readonly integrationPlan: ModelIntegrationPlan;

  /** Ordered unique-role component selection facts accepted before execution. */
  readonly componentSelection: ComponentSelectionResolution;

  /** Complete finite resource limits shared by all interaction stages. */
  readonly resourceLimits: ResolvedInteractionResourceLimits;

  /** Unique protocol adapter used for both request planning and response parsing. */
  readonly taskProtocolAdapter: TaskProtocolAdapter;

  /** Resolver used to produce the interaction's complete service access snapshot. */
  readonly serviceAccessResolver: ServiceAccessResolver;

  /** Unique encoder selected for the protocol request payload. */
  readonly payloadEncoder: PayloadEncoder;

  /** Decoder fixed before I/O for successful transport outcomes. */
  readonly successPayloadDecoder: PayloadDecoder;

  /** Independent decoder fixed before I/O for service-error outcomes. */
  readonly errorPayloadDecoder: PayloadDecoder;

  /** Unique unary transport validated against the protocol execution plan. */
  readonly transport: Transport;

  /** Resolver that later selects the unique handler for the actual authorization. */
  readonly authorizationHandlerResolver: AuthorizationHandlerResolver;

  /** Immutable authorization handler candidates fixed for this interaction. */
  readonly authorizationHandlers: readonly AuthorizationHandler[];

  /** Completed capability facts proving the selected execution path is supported. */
  readonly capabilityResolution: CapabilityResolution;
}
