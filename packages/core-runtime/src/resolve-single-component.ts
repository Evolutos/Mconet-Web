// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type { ComponentRole, RuntimeComponent } from "@evolutos/mconet-core-spi";

/**
 * Selects one component with the Runtime's fixed configuration precedence.
 *
 * Direct interaction and Client choices are already singular and therefore win
 * by presence. Integration candidates occupy one equal-priority tier: exactly
 * one candidate is selected, while multiple candidates fail instead of relying
 * on collection order. The SDK default is used only when all higher tiers are
 * absent. Compatibility filtering must occur before this pure selection step.
 *
 * @typeParam Component Concrete Runtime component contract being selected.
 * @param input Role and candidates from every supported precedence tier.
 * @returns The original uniquely selected component instance.
 * @throws {ModelInteractionError} When no component exists or the integration
 * tier contains multiple candidates.
 */
export function resolveSingleComponent<Component extends RuntimeComponent>(
  input: Readonly<{
    readonly role: ComponentRole;
    readonly interactionComponent?: Component;
    readonly clientComponent?: Component;
    readonly integrationComponents: readonly Component[];
    readonly sdkDefaultComponent?: Component;
  }>,
): Component {
  // An interaction-scoped direct instance is the caller's final choice. Return
  // it without inspecting descriptors or lower-priority candidate ambiguity.
  if (input.interactionComponent !== undefined) {
    return input.interactionComponent;
  }

  // A Client-scoped instance is next and likewise remains final when no current
  // interaction override exists; incompatible direct choices fail elsewhere.
  if (input.clientComponent !== undefined) {
    return input.clientComponent;
  }

  // Integration candidates share one tier. More than one is a configuration
  // conflict even if their descriptors differ, so ordering never selects a winner.
  if (input.integrationComponents.length > 1) {
    throw createAmbiguousSelectionError(input.role, input.integrationComponents.length);
  }

  const integrationComponent = input.integrationComponents[0];
  if (integrationComponent !== undefined) {
    // Preserve the integration-owned instance exactly; selection adds no wrapper,
    // registry identity, ownership metadata, or mutable state.
    return integrationComponent;
  }

  // The SDK default is the last valid source and is consulted only after every
  // caller and integration tier is absent.
  if (input.sdkDefaultComponent !== undefined) {
    return input.sdkDefaultComponent;
  }

  // A required single-value role cannot proceed without an implementation. The
  // structured role remains diagnostic data rather than part of the message.
  throw createMissingComponentError(input.role);
}

/** Creates the stable failure for multiple same-tier integration candidates. */
function createAmbiguousSelectionError(
  role: ComponentRole,
  candidateCount: number,
): ModelInteractionError {
  // One error and one matching diagnostic keep programmatic classification
  // stable while preserving only non-sensitive role and count context.
  return new ModelInteractionError({
    message: "Multiple components matched the same required execution role.",
    category: "invalid_component_configuration",
    phase: "resolution",
    code: "ambiguous_component_selection",
    diagnostics: [
      {
        code: "ambiguous_component_selection",
        severity: "error",
        phase: "resolution",
        message: "A single execution role must resolve to exactly one component.",
        details: { roleId: role.id, candidateCount },
      },
    ],
  });
}

/** Creates the stable failure for an execution role with no available component. */
function createMissingComponentError(role: ComponentRole): ModelInteractionError {
  // The failure does not list descriptors or hidden identifiers because no
  // candidate exists and resolution must not expose registry-like state.
  return new ModelInteractionError({
    message: "No component is available for a required execution role.",
    category: "invalid_component_configuration",
    phase: "resolution",
    code: "component_not_found",
    diagnostics: [
      {
        code: "component_not_found",
        severity: "error",
        phase: "resolution",
        message: "A required execution role has no component implementation.",
        details: { roleId: role.id },
      },
    ],
  });
}
