// Copyright © 2026 Mcont.

import type { HeaderFields, UriValue } from "@evolutos/mconet-core-domain";

/**
 * Immutable non-sensitive summary of a request before authorization is applied.
 *
 * The snapshot keeps the method, a destination without query or fragment text,
 * allowlisted header occurrences, and scalar sizes. It has no field for the
 * encoded body, query values, authorization description, or credential source.
 * Header filtering belongs to the mapper; this type does not claim that every
 * constructed value has already been redacted.
 */
export type SafePreAuthorizationRequestSnapshot = Readonly<{
  /** Protocol method text copied from the encoded request. */
  method: string;

  /** Destination with query and fragment text removed. */
  url: UriValue;

  /** Ordered allowlisted header occurrences. Authorization headers are absent. */
  headers: HeaderFields;

  /** Number of query occurrences, without their names or values. */
  queryCount: number;

  /** Encoded body size in bytes, without the byte sequence. */
  bodyByteLength: number;
}>;
