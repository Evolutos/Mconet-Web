// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

/**
 * Immutable semantic and Schema identities declared by one component boundary.
 *
 * Type identities describe the meaning of values crossing the input and output
 * ports, while Schema identities optionally name their concrete representation.
 * Every field is independently optional so components can declare only the
 * evidence their port contract actually provides. This value contains no
 * component identity, version, capability, implementation, runtime value,
 * selection priority, validation result, or executable behavior.
 */
export interface ComponentTypeContract {
  /** Optional semantic identity accepted by the component input port. */
  readonly inputTypeId?: OpenIdentifier;

  /** Optional Schema identity constraining the component input representation. */
  readonly inputSchemaId?: string;

  /** Optional semantic identity produced by the component output port. */
  readonly outputTypeId?: OpenIdentifier;

  /** Optional Schema identity constraining the component output representation. */
  readonly outputSchemaId?: string;
}
