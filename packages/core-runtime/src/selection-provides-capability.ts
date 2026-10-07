// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";
import type { ComponentSelectionResolution } from "@evolutos/mconet-core-spi";

/**
 * Determines whether any selected descriptor snapshot provides one capability.
 *
 * The helper reads only the descriptor captured by `SelectedComponent`; it never
 * reopens a live component descriptor or consults unselected candidates. It is a
 * package-internal primitive shared by required and complete capability resolution.
 *
 * @param componentSelection Fixed selected-component facts for one interaction.
 * @param capabilityId Open capability identity to find.
 * @returns Whether at least one selected descriptor declares the identity.
 */
export function selectionProvidesCapability(
  componentSelection: ComponentSelectionResolution,
  capabilityId: OpenIdentifier,
): boolean {
  // Set membership is exact and short-circuits at the first provider without
  // ranking components, invoking behavior, or exposing provider identity.
  return componentSelection.components.some((selected) =>
    selected.descriptor.capabilities.has(capabilityId),
  );
}
