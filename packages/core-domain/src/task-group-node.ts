// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "./open-identifier.js";
import type { TaskNodeBase } from "./task-node-base.js";
import type { TaskNode } from "./task-node.js";

/**
 * Immutable container node in an ordered Task-document tree.
 *
 * A group carries only shared Task-node fields, fixed container composition,
 * and ordered child nodes. It contains no task-specific value, Message content,
 * Artifact data, protocol payload, access configuration, or execution behavior.
 * Child values use the public TaskNode union as the recursive boundary, keeping
 * arbitrary shared-base objects outside a concrete Task tree.
 */
export interface TaskGroupNode extends TaskNodeBase {
  /** Standard group identity or an integration-defined container kind. */
  readonly kind: "task.root" | "task.group" | (OpenIdentifier & Record<never, never>);

  /** Fixed structural role distinguishing this node as a container. */
  readonly composition: "container";

  /** Ordered child Task nodes retained without sorting or normalization. */
  readonly children: readonly TaskNode[];
}
