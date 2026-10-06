// Copyright © 2026 Mcont.

import type { ModelTaskRequest } from "./model-task-request.js";
import type { TaskDescriptor } from "./task-descriptor.js";

/**
 * Immutable model-task request for conversation generation.
 *
 * The descriptor type is fixed independently from the TaskDocument contents.
 * Conversation input and generation settings remain concrete nodes inside the
 * document, while Artifact scope, metadata, and extensions retain the common
 * open request boundaries. Semantic tree validation remains a later operation.
 */
export interface ConversationTaskRequest extends ModelTaskRequest {
  /** Fixed conversation-generation descriptor with all shared descriptor data. */
  readonly descriptor: TaskDescriptor & {
    readonly type: "conversation.generate";
  };
}
