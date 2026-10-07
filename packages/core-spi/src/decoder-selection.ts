// Copyright © 2026 Mcont.

import type { MediaType } from "@evolutos/mconet-core-domain";

/**
 * Immutable criteria used to select one payload decoder before network I/O.
 *
 * Successful and failed response paths each retain an independent value of this
 * type. Actual response metadata may later be checked for compatibility, but it
 * cannot mutate the planned criteria or replace the decoder already selected by
 * the deterministic component resolver.
 */
export interface DecoderSelection {
  /** Optional planned media type the selected decoder must support. */
  readonly mediaType?: MediaType;

  /** Optional schema identity required by the decoded payload contract. */
  readonly schemaId?: string;
}
