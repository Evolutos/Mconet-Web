// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";
import type {
  CapabilityRequirement,
  CapabilityResolution,
  ComponentSelectionResolution,
  PlannedComponentSelection,
} from "@evolutos/mconet-core-spi";

import { resolveCapabilities } from "./resolve-capabilities.js";

/**
 * Schedules capability validation for one already selected execution path.
 *
 * Transport requirements and mode-component requirements are collected in that
 * order and passed once to the existing resolver. A missing required capability
 * fails before an execution snapshot exists. This stage does not select a
 * component, read a live descriptor, or call a transport.
 *
 * @param input Planned capability sets and the fixed component selection.
 * @returns The frozen capability facts for this interaction.
 * @throws {ModelInteractionError} When a required capability is absent.
 */
export function scheduleCapabilityValidation(input: {
  readonly transportCapabilities: ReadonlySet<OpenIdentifier>;
  readonly modeComponents: readonly PlannedComponentSelection[];
  readonly componentSelection: ComponentSelectionResolution;
}): CapabilityResolution {
  const requirements: CapabilityRequirement[] = [];

  // Transport requirements come first so their declaration order stays ahead of
  // mode-component requirements when both name the same capability.
  for (const capabilityId of input.transportCapabilities) {
    requirements.push({ capabilityId, required: true });
  }
  for (const modeComponent of input.modeComponents) {
    for (const capabilityId of modeComponent.requiredCapabilities) {
      requirements.push({ capabilityId, required: true });
    }
  }

  return resolveCapabilities({
    requirements,
    componentSelection: input.componentSelection,
  });
}
