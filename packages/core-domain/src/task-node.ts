// Copyright © 2026 Mcont.

import type { TaskGroupNode } from "./task-group-node.js";
import type { UnknownTaskNode } from "./unknown-task-node.js";

/**
 * Immutable Task-document node variants currently defined by core-domain.
 *
 * Container composition identifies TaskGroupNode, while leaf composition
 * identifies the preservation-only UnknownTaskNode until additional typed leaf
 * contracts join this union. The union contains no Message element, Artifact,
 * protocol value, model configuration, access data, or runtime behavior.
 */
export type TaskNode = TaskGroupNode | UnknownTaskNode;
