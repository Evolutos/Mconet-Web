// Copyright © 2026 Mcont.

import type { ResolvedServiceAccess, ServiceAccess } from "@evolutos/mconet-core-domain";
import type { ServiceAccessResolver } from "@evolutos/mconet-core-spi";

import { DefaultServiceAccessResolver } from "./default-service-access-resolver.js";

/** Stateless builtin used only when the caller does not inject a resolver. */
const defaultServiceAccessResolver = new DefaultServiceAccessResolver();

/**
 * Schedules service-access resolution for one interaction.
 *
 * The selected resolver is called once with the four labelled layers. Field
 * precedence stays inside that resolver. This stage does not invent an
 * endpoint, authorization, or relative base when every layer omits them, and
 * it does not read credentials or call a transport.
 *
 * @param input Optional resolver and the four access layers in precedence order.
 * @returns The resolver's complete access snapshot.
 * @throws {ModelInteractionError} When the resolver cannot form a complete snapshot.
 * @throws {TypeError} When a supplied layer violates the access contract.
 */
export function scheduleServiceAccessResolution(input: {
  readonly resolver?: ServiceAccessResolver;
  readonly interactionOverride?: ServiceAccess;
  readonly requestAccess?: ServiceAccess;
  readonly clientDefault?: ServiceAccess;
  readonly integrationDefault?: ServiceAccess;
}): ResolvedServiceAccess {
  const resolver = input.resolver ?? defaultServiceAccessResolver;

  // Omit absent layers so an explicit undefined cannot be stored as a value.
  return resolver.resolve({
    ...(input.interactionOverride === undefined
      ? {}
      : { interactionOverride: input.interactionOverride }),
    ...(input.requestAccess === undefined ? {} : { requestAccess: input.requestAccess }),
    ...(input.clientDefault === undefined ? {} : { clientDefault: input.clientDefault }),
    ...(input.integrationDefault === undefined
      ? {}
      : { integrationDefault: input.integrationDefault }),
  });
}
