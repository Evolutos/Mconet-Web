// Copyright © 2026 Mcont.

import type { MediaType, OpenIdentifier } from "@evolutos/mconet-core-domain";

/**
 * Immutable semantic and Schema identities declared by one component boundary.
 *
 * Type identities describe the meaning of values crossing the input and output
 * ports, Schema identities optionally name their concrete representation, and
 * media types declare the wire representations accepted or produced by those
 * ports. Every field is independently optional so components can declare only
 * the evidence their port contract actually provides. Media type collections
 * are read-only and use set-like, order-independent matching semantics. This
 * value contains no component identity, version, capability, implementation,
 * runtime value, selection priority, validation result, or executable behavior.
 */
export interface ComponentTypeContract {
  /** Optional semantic identity accepted by the component input port. */
  readonly inputTypeId?: OpenIdentifier;

  /** Optional Schema identity constraining the component input representation. */
  readonly inputSchemaId?: string;

  /** Optional wire representations accepted by the component input port. */
  readonly inputMediaTypes?: readonly MediaType[];

  /** Optional semantic identity produced by the component output port. */
  readonly outputTypeId?: OpenIdentifier;

  /** Optional Schema identity constraining the component output representation. */
  readonly outputSchemaId?: string;

  /** Optional wire representations produced by the component output port. */
  readonly outputMediaTypes?: readonly MediaType[];
}
