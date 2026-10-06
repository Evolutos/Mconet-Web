// Copyright © 2026 Mcont.

import type { ConversationInputNode } from "./conversation-input-node.js";
import type { TaskGroupNode } from "./task-group-node.js";
import type { UnknownTaskNode } from "./unknown-task-node.js";

/**
 * Immutable Task-document node variants currently defined by core-domain.
 *
 * Container composition identifies TaskGroupNode. ConversationInputNode is the
 * typed leaf carrying MessageDocument, while UnknownTaskNode preserves every
 * other current leaf kind. The union contains no Message element directly,
 * Artifact, protocol value, model selection, access data, or runtime behavior.
 */
export type TaskNode = TaskGroupNode | ConversationInputNode | UnknownTaskNode;
