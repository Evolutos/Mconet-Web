// Copyright © 2026 Mcont.

import { ModelInteractionError, type OpenIdentifier } from "@evolutos/mconet-core-domain";
import type {
  CapabilityRequirement,
  CapabilityResolution,
  ComponentSelectionResolution,
} from "@evolutos/mconet-core-spi";

import { selectionProvidesCapability } from "./selection-provides-capability.js";

/**
 * Resolves every required capability against already selected components.
 *
 * Capability membership comes only from the immutable descriptor snapshots in
 * `ComponentSelectionResolution`; unselected components and live component
 * descriptor getters cannot contribute. Required requirements retain declaration
 * order and object identity when satisfied. Optional requirements are deliberately
 * left for the subsequent optional-diagnostic step and never fail this resolver.
 *
 * @param input Ordered requirements and fixed selected-component snapshots.
 * @returns A new frozen partial resolution containing satisfied required facts.
 * @throws {ModelInteractionError} With `unsupported_capability` when any required
 * capability is absent from every selected component.
 */
export function resolveRequiredCapabilities(
  input: Readonly<{
    readonly requirements: readonly CapabilityRequirement[];
    readonly componentSelection: ComponentSelectionResolution;
  }>,
): CapabilityResolution {
  const satisfied: CapabilityRequirement[] = [];

  // Preserve requirement order and duplicates. Each declaration is a separate
  // fact even when multiple sources requested the same open capability identity.
  for (const requirement of input.requirements) {
    if (!requirement.required) {
      // Optional support and warning diagnostics belong to the next independent
      // resolution step; this pass neither satisfies nor reports them.
      continue;
    }

    if (!selectionProvidesCapability(input.componentSelection, requirement.capabilityId)) {
      // Fail before an execution snapshot can be created. No partial resolution
      // escapes and no lower-level component behavior is invoked.
      throw createUnsupportedRequiredCapabilityError(requirement.capabilityId);
    }

    // Retain the exact requirement object rather than reducing it to a bare ID or
    // manufacturing provider metadata that the current contract does not model.
    satisfied.push(requirement);
  }

  // The resolver owns these result envelopes, so shallow-freeze each collection
  // and the outer value while preserving caller-owned requirement identities.
  const frozenSatisfied = Object.freeze(satisfied);
  const optionalUnsupported = Object.freeze([]);
  const diagnostics = Object.freeze([]);
  return Object.freeze({
    satisfied: frozenSatisfied,
    optionalUnsupported,
    diagnostics,
  });
}

/** Creates the stable failure for one unsupported required capability. */
function createUnsupportedRequiredCapabilityError(
  capabilityId: OpenIdentifier,
): ModelInteractionError {
  // Capability IDs are portable protocol metadata and safe diagnostic context.
  // Component names, candidates, request data, and any partial result stay absent.
  return new ModelInteractionError({
    message: "A required interaction capability is unavailable.",
    category: "unsupported_feature",
    phase: "resolution",
    code: "unsupported_capability",
    diagnostics: [
      {
        code: "unsupported_capability",
        severity: "error",
        phase: "resolution",
        message: "No selected component provides a required capability.",
        details: { capabilityId },
      },
    ],
  });
}
