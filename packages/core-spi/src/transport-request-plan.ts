// Copyright © 2026 Mcont.

import type {
  Authorization,
  HeaderFields,
  QueryFields,
  UriValue,
} from "@evolutos/mconet-core-domain";

/**
 * Immutable protocol-owned transport request facts before payload encoding.
 *
 * The resolved endpoint and protocol path remain separate so Runtime can join
 * them without reparsing either value. Ordered headers and query occurrences
 * preserve duplicates, authorization stays opaque for later handler selection,
 * and transport extensions carry local planning values. Initial Web support
 * deliberately excludes body and chunk signing requirements.
 */
export interface TransportRequestPlan {
  /** Absolute resolved service endpoint retained without path composition. */
  readonly endpoint: Extract<UriValue, { readonly kind: "absolute" }>;

  /** Protocol request path preserved without joining or normalization. */
  readonly path: string;

  /** Protocol method text preserved without transport-specific validation. */
  readonly method: string;

  /** Ordered non-sensitive protocol header occurrences. */
  readonly headers: HeaderFields;

  /** Ordered protocol query occurrences before transport encoding. */
  readonly query: QueryFields;

  /** Opaque authorization description for later compatible-handler selection. */
  readonly authorization: Authorization;

  /** Read-only top-level transport-specific planning values. */
  readonly transportExtensions: Readonly<Record<string, unknown>>;
}
