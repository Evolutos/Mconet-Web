// Copyright © 2026 Mcont.

import type { MessageDocument } from "./message-document.js";
import type { ModelTaskResult } from "./model-task-result.js";
import type { TaskDescriptor } from "./task-descriptor.js";

/**
 * Immutable model-task result for conversation generation.
 *
 * The descriptor type is fixed independently from result contents. The complete
 * MessageDocument remains an authoritative, independently versioned Message
 * tree, while the common TaskDocument, result-local Artifact scope, metadata,
 * and extensions retain their ModelTaskResult boundaries. Text projection and
 * semantic response validation remain later operations.
 */
export interface ConversationTaskResult extends ModelTaskResult {
  /** Fixed conversation-generation descriptor with all shared descriptor data. */
  readonly descriptor: TaskDescriptor & {
    readonly type: "conversation.generate";
  };

  /** Complete Message-domain document containing conversation output. */
  readonly messages: MessageDocument;
}
