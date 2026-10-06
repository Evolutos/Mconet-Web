// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { TaskGroupNode } from "./task-group-node.js";

/**
 * Immutable versioned envelope for one Task-domain tree.
 *
 * The root is always a TaskGroupNode so a leaf cannot replace the document
 * container. Version, metadata, and extensions remain portable descriptive data.
 * This envelope contains no Message root, ArtifactCatalog, model target, service
 * access, protocol payload, validation, traversal, or execution behavior.
 */
export interface TaskDocument {
  /** Opaque Task-document schema version interpreted by later boundaries. */
  readonly version: string;

  /** Required container at the root of the ordered Task tree. */
  readonly root: TaskGroupNode;

  /** Always-present JSON-compatible document metadata. */
  readonly metadata: Readonly<Record<string, JsonValue>>;

  /** Always-present namespaced extensions for forward-compatible Task data. */
  readonly extensions: Extensions;
}
