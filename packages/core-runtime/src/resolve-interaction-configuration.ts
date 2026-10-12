// Copyright © 2026 Mcont.

import type {
  ResolvedInteractionResourceLimits,
  ServiceAccess,
} from "@evolutos/mconet-core-domain";

import type { InteractionContext } from "./interaction-context.js";
import { mergeInteractionConfiguration } from "./merge-interaction-configuration.js";
import type { ModelClientConfigurationData } from "./model-client-configuration-data.js";
import type { ResolvedInteractionConfiguration } from "./resolved-interaction-configuration.js";

/**
 * Schedules configuration resolution for one interaction.
 *
 * Request target and access, interaction options, client defaults, and an
 * integration access value are read and merged into a new snapshot. Nothing is
 * written back onto the client configuration. Deadline conversion and signal
 * composition stay in their own stages.
 *
 * @param input Context, reusable client data, and the limits used as the SDK floor.
 * @returns The frozen configuration snapshot for this interaction only.
 */
export function resolveInteractionConfiguration(input: {
  readonly context: InteractionContext;
  readonly clientConfiguration: ModelClientConfigurationData;
  readonly integrationServiceAccess?: ServiceAccess;
  readonly sdkResourceLimits: ResolvedInteractionResourceLimits;
}): ResolvedInteractionConfiguration {
  // Read the client object. Assignment would publish a one-request value as a
  // reusable default, so this function never writes its properties.
  return mergeInteractionConfiguration({
    requestTarget: input.context.request.target,
    requestServiceAccess: input.context.request.serviceAccess,
    clientConfiguration: input.clientConfiguration,
    interactionOptions: input.context.options,
    integrationServiceAccess: input.integrationServiceAccess,
    sdkResourceLimits: input.sdkResourceLimits,
  });
}
