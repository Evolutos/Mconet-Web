// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { OpenIdentifier } from "./open-identifier.js";
import type { TaskRelation } from "./task-relation.js";

/**
 * Package-internal immutable fields shared by task-document nodes.
 *
 * This base belongs only to the Task domain and neither extends nor references
 * MessageElementBase. Concrete Task nodes separately declare composition,
 * children, or domain payloads so no generic tree shape erases their invariants.
 * Protocol, model, service access, Artifact data, and execution state stay out.
 *
 * The interface is exported from its module for package-internal extension but
 * is intentionally absent from the package entry point.
 */
export interface TaskNodeBase {
  /** Stable node identity within its containing TaskDocument. */
  readonly id: string;

  /** Standard or integration-defined Task-node classification. */
  readonly kind: OpenIdentifier;

  /** Ordered directed relations expressed only through stable Task-node IDs. */
  readonly relations: readonly TaskRelation[];

  /** Always-present JSON-compatible application metadata. */
  readonly metadata: Readonly<Record<string, JsonValue>>;

  /** Always-present namespaced extensions for forward-compatible Task data. */
  readonly extensions: Extensions;
}
