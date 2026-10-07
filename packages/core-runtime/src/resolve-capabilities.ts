// Copyright © 2026 Mcont.

import type { Diagnostic } from "@evolutos/mconet-core-domain";
import type {
  CapabilityRequirement,
  CapabilityResolution,
  ComponentSelectionResolution,
} from "@evolutos/mconet-core-spi";

import { resolveRequiredCapabilities } from "./resolve-required-capabilities.js";
import { selectionProvidesCapability } from "./selection-provides-capability.js";

/**
 * Resolves required and optional capabilities for one fixed component selection.
 *
 * Required resolution runs first and remains fail-fast. After it succeeds, this
 * function walks the original requirement sequence once to preserve global order:
 * required and supported optional requirements enter `satisfied`, while each
 * unsupported optional requirement is retained with one warning diagnostic. The
 * result is a new frozen fact snapshot and performs no fallback or component work.
 *
 * @param input Ordered requirements and fixed selected-component snapshots.
 * @returns Complete immutable capability facts for the current interaction.
 * @throws {ModelInteractionError} When a required capability is unavailable.
 */
export function resolveCapabilities(
  input: Readonly<{
    readonly requirements: readonly CapabilityRequirement[];
    readonly componentSelection: ComponentSelectionResolution;
  }>,
): CapabilityResolution {
  // Validate every required declaration before allocating any externally visible
  // optional result. The returned partial snapshot is intentionally not reused,
  // because the complete result must restore original required/optional order.
  resolveRequiredCapabilities(input);

  const satisfied: CapabilityRequirement[] = [];
  const optionalUnsupported: CapabilityRequirement[] = [];
  const diagnostics: Diagnostic[] = [];

  // Traverse the original sequence so supported optional entries remain exactly
  // where callers declared them relative to required entries.
  for (const requirement of input.requirements) {
    if (
      requirement.required ||
      selectionProvidesCapability(input.componentSelection, requirement.capabilityId)
    ) {
      // Required entries are already proven by the first pass. Optional entries
      // reach this branch only when a selected descriptor declares their ID.
      satisfied.push(requirement);
      continue;
    }

    // Preserve each unsupported optional declaration, including duplicates, and
    // emit one ordered portable observation without turning it into a failure.
    optionalUnsupported.push(requirement);
    diagnostics.push(createOptionalUnsupportedDiagnostic(requirement));
  }

  // Freeze only resolver-owned envelopes. Caller-owned requirements and selected
  // descriptor snapshots keep their original identities and ownership.
  return Object.freeze({
    satisfied: Object.freeze(satisfied),
    optionalUnsupported: Object.freeze(optionalUnsupported),
    diagnostics: Object.freeze(diagnostics),
  });
}

/** Creates one stable warning for an unsupported optional capability. */
function createOptionalUnsupportedDiagnostic(requirement: CapabilityRequirement): Diagnostic {
  // Capability identity is safe protocol metadata. No provider candidates,
  // component names, request data, or behavior-derived content enters the warning.
  const details = Object.freeze({ capabilityId: requirement.capabilityId });
  return Object.freeze({
    code: "unsupported_capability",
    severity: "warning",
    phase: "resolution",
    message: "An optional interaction capability is unavailable.",
    details,
  });
}
