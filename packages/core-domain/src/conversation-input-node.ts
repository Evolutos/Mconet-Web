// Copyright © 2026 Mcont.

import type { MessageDocument } from "./message-document.js";
import type { TaskNodeBase } from "./task-node-base.js";
import type { ToolDeclaration } from "./tool-call.js";

/**
 * Immutable Task leaf carrying one conversation MessageDocument as input.
 *
 * Message data enters the Task tree only through the `messages` reference.
 * Optional function declarations travel beside that document. They name tools
 * the model may call; they are not messages, generation controls, or
 * implementations. The node adds no Artifact references, model target, access
 * configuration, or behavior.
 */
export interface ConversationInputNode extends TaskNodeBase {
  /** Fixed classification for a conversation-input Task leaf. */
  readonly kind: "task.input.conversation";

  /** Fixed structural role distinguishing the input node as a leaf. */
  readonly composition: "leaf";

  /** Complete Message-domain document retained by reference as Task input. */
  readonly messages: MessageDocument;

  /**
   * Function tools declared for this conversation.
   *
   * Omission means the request names no tools. An empty list is not a substitute
   * for omission.
   */
  readonly tools?: readonly ToolDeclaration[];
}
