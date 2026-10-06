// Copyright © 2026 Mcont.

import type { JsonValue } from "./json-value.js";
import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Immutable directed relation between two task-node identities.
 *
 * Source and target are stable IDs resolved within the containing TaskDocument.
 * The relation belongs only to the Task domain and never embeds TaskNode objects
 * or reuses MessageRelation as a public parent type. Its open classification and
 * JSON metadata carry descriptive data without traversal or execution behavior.
 */
export interface TaskRelation {
  /** Stable ID of the task node where the directed relation originates. */
  readonly sourceId: string;

  /** Stable ID of the task node where the directed relation terminates. */
  readonly targetId: string;

  /** Standard or integration-defined task relationship classification. */
  readonly type: OpenIdentifier;

  /** Always-present JSON-compatible data describing this relationship. */
  readonly metadata: Readonly<Record<string, JsonValue>>;
}
