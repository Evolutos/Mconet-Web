// Copyright © 2026 Mcont.

/**
 * Immutable protocol-independent name and value for one query occurrence.
 *
 * Names remain case-sensitive and both strings retain their pre-encoding form.
 * A later ordered collection preserves repeated names, while the target
 * transport owns validation, percent-encoding, delimiter handling, and final
 * URL construction.
 */
export interface QueryField {
  /** Caller-supplied case-sensitive query name before percent-encoding. */
  readonly name: string;

  /** Caller-supplied query value before percent-encoding. */
  readonly value: string;
}
