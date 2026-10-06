// Copyright © 2026 Mcont.

import {
  createDefaultCompatibilityPolicy,
  resolveInteractionResourceLimits,
  type ModelTarget,
  type ResolvedInteractionResourceLimits,
  type ServiceAccess,
} from "@evolutos/mconet-core-domain";

import type { InteractionOptionsData } from "./interaction-options-data.js";
import type { ModelClientConfigurationData } from "./model-client-configuration-data.js";
import type { ResolvedInteractionConfiguration } from "./resolved-interaction-configuration.js";

/**
 * Merges pure interaction configuration data using fixed source priorities.
 *
 * Target selection uses request then client data. Service access selects the
 * first whole input from interaction, request, client, and integration sources.
 * Compatibility selects interaction then client data before creating the SDK
 * default. Resource limits delegate independent field resolution to the shared
 * domain resolver. Cancellation belongs exclusively to the interaction layer.
 *
 * The function performs no component selection, monitoring merge, access-field
 * merge, deadline conversion, signal composition, input mutation, or I/O.
 *
 * @param input Explicit source values required for deterministic resolution.
 * @returns A new frozen complete configuration snapshot.
 * @throws {TypeError} When neither request nor client data supplies a target,
 * or when a resource-limit layer violates its existing validator contract.
 */
export function mergeInteractionConfiguration(
  input: Readonly<{
    readonly requestTarget: ModelTarget | undefined;
    readonly requestServiceAccess: ServiceAccess | undefined;
    readonly clientConfiguration: ModelClientConfigurationData;
    readonly interactionOptions: InteractionOptionsData;
    readonly integrationServiceAccess: ServiceAccess | undefined;
    readonly sdkResourceLimits: ResolvedInteractionResourceLimits;
  }>,
): ResolvedInteractionConfiguration {
  // Select the required target without allowing interaction or integration data
  // to alter the documented Request-over-Client priority.
  const target = input.requestTarget ?? input.clientConfiguration.defaultTarget;
  if (target === undefined) {
    throw new TypeError(
      "requestTarget or clientConfiguration.defaultTarget must provide a target.",
    );
  }

  // ServiceAccess remains one opaque input reference at this boundary. A later
  // resolver receives the original layers when it performs field-level merging.
  const serviceAccess =
    input.interactionOptions.serviceAccessOverride ??
    input.requestServiceAccess ??
    input.clientConfiguration.defaultServiceAccess ??
    input.integrationServiceAccess;

  // Preserve an explicit strategy by identity and allocate the frozen standard
  // fallback only when neither interaction nor client data supplies a policy.
  const compatibilityPolicy =
    input.interactionOptions.compatibilityPolicy ??
    input.clientConfiguration.defaultCompatibilityPolicy ??
    createDefaultCompatibilityPolicy();

  // Delegate validation and independent field precedence so this merger cannot
  // diverge from the existing resource-limit contract or hide invalid layers.
  const resourceLimits = resolveInteractionResourceLimits(
    input.sdkResourceLimits,
    input.clientConfiguration.defaultResourceLimits,
    input.interactionOptions.resourceLimits,
  );

  // Construct a new shallow-frozen result with explicit optional-valued keys.
  // Signal identity is retained without subscription; deadline conversion and
  // signal composition remain in their later dedicated helpers.
  return Object.freeze({
    target,
    serviceAccess,
    compatibilityPolicy,
    resourceLimits,
    signal: input.interactionOptions.signal,
  });
}
