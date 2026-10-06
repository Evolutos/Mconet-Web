// Copyright © 2026 Mcont.

import type { Authorization } from "./authorization.js";
import type { Extensions } from "./extensions.js";
import type { HeaderFields } from "./header-fields.js";
import type { QueryFields } from "./query-fields.js";
import type { UriValue } from "./uri-value.js";

/**
 * Immutable unresolved configuration for connecting to a model service.
 *
 * Optional fields retain caller-level defaulting semantics until a dedicated
 * resolver produces a complete access snapshot. Headers, query fields, and
 * extensions remain non-sensitive data; credentials belong exclusively to a
 * concrete authorization description and its credential source.
 */
export interface ServiceAccess {
  /** Optional endpoint URI reference supplied at this configuration level. */
  readonly endpoint?: UriValue;

  /** Optional authorization description supplied at this configuration level. */
  readonly authorization?: Authorization;

  /** Ordered non-sensitive header occurrences contributed by this configuration. */
  readonly headers: HeaderFields;

  /** Ordered query occurrences contributed by this configuration. */
  readonly query: QueryFields;

  /** Optional service API version hint interpreted by the selected integration. */
  readonly apiVersion?: string;

  /** Optional provider project identifier without credential semantics. */
  readonly projectId?: string;

  /** Optional provider tenant identifier without credential semantics. */
  readonly tenantId?: string;

  /** Protocol-independent extension data for explicitly supported consumers. */
  readonly extensions: Extensions;
}
