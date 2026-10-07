// Copyright © 2026 Mcont.

import type { Authorization } from "./authorization.js";
import type { Extensions } from "./extensions.js";
import type { HeaderFields } from "./header-fields.js";
import type { QueryFields } from "./query-fields.js";
import type { UriValue } from "./uri-value.js";

/**
 * Complete immutable service access snapshot for one interaction.
 *
 * Resolution replaces configuration-layer omission with one absolute endpoint,
 * one explicit authorization description, and stable ordered metadata. Provider
 * context remains optional because its absence can be a valid final value, not a
 * request to inherit from another layer. Credentials remain encapsulated by the
 * concrete authorization description and never enter headers or extensions.
 */
export interface ResolvedServiceAccess {
  /** Absolute service endpoint selected before protocol request construction. */
  readonly endpoint: Extract<UriValue, { readonly kind: "absolute" }>;

  /** Explicit authorization selected for this interaction, including no-auth. */
  readonly authorization: Authorization;

  /** Ordered resolved non-sensitive custom header occurrences. */
  readonly headers: HeaderFields;

  /** Ordered resolved custom query occurrences. */
  readonly query: QueryFields;

  /** Optional final provider API version context. */
  readonly apiVersion?: string;

  /** Optional final provider project context. */
  readonly projectId?: string;

  /** Optional final provider tenant context. */
  readonly tenantId?: string;

  /** Resolved protocol-independent extension data. */
  readonly extensions: Extensions;
}
