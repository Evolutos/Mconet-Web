// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { MessageRelation } from "./message-relation.js";
import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Package-internal immutable fields shared by message-tree elements.
 *
 * The base is intentionally specific to the Message domain and does not extend
 * or reference TaskNode. Concrete elements separately define leaf content or
 * container children, preventing one generic tree shape from erasing their
 * distinct invariants. No protocol, access, model, or execution state belongs here.
 *
 * The interface is exported from its module for package-internal extension but
 * is not exported from the package entry point.
 */
export interface MessageElementBase {
  /** Stable element identity within its containing message document. */
  readonly id: string;

  /** Standard or integration-defined message-element classification. */
  readonly kind: OpenIdentifier;

  /** Ordered directed relations expressed only through stable element IDs. */
  readonly relations: readonly MessageRelation[];

  /** Always-present JSON-compatible application metadata. */
  readonly metadata: Readonly<Record<string, JsonValue>>;

  /** Always-present namespaced extensions for forward-compatible data. */
  readonly extensions: Extensions;
}
