// Copyright © 2026 Mcont.

/**
 * Immutable URI reference represented without exposing a mutable platform URL.
 *
 * The discriminator preserves whether resolution against a base URI is needed.
 * Syntax, encoding, scheme, and trust-boundary checks belong to the dedicated
 * validator; this type stores the original validated reference without rewrite.
 */
export type UriValue =
  | {
      readonly kind: "absolute";
      readonly value: string;
    }
  | {
      readonly kind: "relative";
      readonly value: string;
    };
