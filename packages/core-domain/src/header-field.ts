// Copyright © 2026 Mcont.

/**
 * Immutable protocol-independent name and value for one header occurrence.
 *
 * A field represents exactly one occurrence so a later ordered collection can
 * preserve repeated names without coalescing values. The name uses the shared
 * lowercase form for case-insensitive comparison, while the value remains
 * verbatim. Name/value validation, authorization restrictions, and platform-
 * specific serialization belong to dedicated boundaries before network I/O.
 */
export interface HeaderField {
  /** Normalized lowercase field name used for case-insensitive comparison. */
  readonly name: string;

  /** Caller-supplied field value retained without trimming or joining. */
  readonly value: string;
}
