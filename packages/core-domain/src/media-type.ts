// Copyright © 2026 Mcont.

/**
 * Immutable media type separated into its registration tree and parameters.
 *
 * The top-level type and subtype remain separate so consumers can compare the
 * semantic parts without reparsing a combined string. Parameter names map to
 * their decoded string values. Untrusted strings must use the dedicated parser,
 * which owns syntax validation, case normalization, and quoted-string handling.
 */
export interface MediaType {
  /** Normalized top-level type, such as `application` or `text`. */
  readonly type: string;

  /** Normalized subtype, including any structured suffix such as `problem+json`. */
  readonly subtype: string;

  /** Normalized parameter names mapped to their decoded string values. */
  readonly parameters: Readonly<Record<string, string>>;
}
