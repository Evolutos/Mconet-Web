// Copyright © 2026 Mcont.

import type { ResolvedInteractionConfiguration } from "./resolved-interaction-configuration.js";
import type { SafeConfigurationSnapshot } from "./safe-configuration-snapshot.js";

/**
 * Copies the allowlisted scalar summary of resolved interaction configuration.
 *
 * Only target identifiers, the authorization discriminator, compatibility mode,
 * finite byte limits, and source-presence flags are read. The mapper never
 * enumerates or spreads source objects, so endpoint text, headers, query values,
 * metadata, extensions, authorization payloads, credentials, and signals cannot
 * be copied implicitly.
 *
 * Inputs are expected to have passed their owning domain validators and the
 * configuration resolver. This mapper performs projection rather than repeating
 * validation or normalizing caller data.
 *
 * @param configuration Complete resolved interaction configuration.
 * @returns A new frozen snapshot containing only explicitly allowlisted scalars.
 */
export function createSafeConfigurationSnapshot(
  configuration: ResolvedInteractionConfiguration,
): SafeConfigurationSnapshot {
  const { target, serviceAccess, compatibilityPolicy, resourceLimits, signal } = configuration;

  // Read only the authorization discriminator. Scheme-specific properties stay
  // unreachable because neither authorization nor service access is enumerated.
  const authorizationKind = serviceAccess?.authorization?.kind;

  // Build a fresh object from explicit primitive leaves. This prevents extra
  // structural properties on any source object from crossing the snapshot
  // boundary and prevents later source mutation from changing recorded values.
  return Object.freeze({
    serviceId: target.serviceId,
    protocolId: target.protocolId,
    modelName: target.model.name,
    deploymentId: target.deploymentId,
    authorizationKind,
    compatibilityMode: compatibilityPolicy.mode,
    maxResponseBodyBytes: resourceLimits.maxResponseBodyBytes,
    maxStreamingErrorBodyBytes: resourceLimits.maxStreamingErrorBodyBytes,
    maxFrameBytes: resourceLimits.maxFrameBytes,
    hasServiceAccess: serviceAccess !== undefined,
    hasSignal: signal !== undefined,
  });
}
