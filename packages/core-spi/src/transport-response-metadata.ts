// Copyright © 2026 Mcont.

import type { Extensions, HeaderFields, MediaType } from "@evolutos/mconet-core-domain";

import type { TransportOutcome } from "./transport-outcome.js";

/**
 * Immutable protocol-neutral facts observed for one transport response.
 *
 * The normalized outcome remains separate from optional native numeric and
 * textual status values. Ordered headers, optional trailers, structured media
 * type, request identity, and portable extensions preserve response evidence
 * without carrying the body, choosing a decoder, parsing a service error,
 * inferring retry behavior, or reclassifying the supplied outcome.
 */
export interface TransportResponseMetadata {
  /** Normalized transport classification used by fixed response dispatch. */
  readonly outcome: TransportOutcome;

  /** Ordered response headers, including repeated field names. */
  readonly headers: HeaderFields;

  /** Native numeric status when the selected transport reports one. */
  readonly statusCode?: number;

  /** Native textual status used by protocols without a numeric status. */
  readonly protocolStatusCode?: string;

  /** Ordered trailing headers when the selected protocol reports them. */
  readonly trailers?: HeaderFields;

  /** Parsed response representation media type when explicitly available. */
  readonly mediaType?: MediaType;

  /** Request identity reported by the remote service or transport. */
  readonly requestId?: string;

  /** Transport-specific portable facts that do not alter standard semantics. */
  readonly extensions: Extensions;
}
