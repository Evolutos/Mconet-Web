// Copyright © 2026 Mcont.

import type { MediaType } from "@evolutos/mconet-core-domain";

/**
 * Immutable criteria used to select one payload encoder for a protocol plan.
 *
 * Either criterion may be omitted. The value describes protocol requirements,
 * not a component identity or implementation. Candidate discovery, type-contract
 * validation, capability matching, and ambiguity handling remain responsibilities
 * of the later deterministic component resolver.
 */
export interface EncoderSelection {
  /** Optional structured media type the selected encoder must support. */
  readonly mediaType?: MediaType;

  /** Optional schema identity required by the protocol payload contract. */
  readonly schemaId?: string;
}
