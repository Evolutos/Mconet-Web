// Copyright © 2026 Mcont.

import type { MessageDocument } from "./message-document.js";
import type { TaskNodeBase } from "./task-node-base.js";

/**
 * Immutable Task leaf carrying one conversation MessageDocument as input.
 *
 * Message data enters the Task tree only through the `messages` reference. The
 * node adds no duplicate roles, contents, Artifact references, generation
 * parameters, model target, access configuration, protocol data, or behavior.
 */
export interface ConversationInputNode extends TaskNodeBase {
  /** Fixed classification for a conversation-input Task leaf. */
  readonly kind: "task.input.conversation";

  /** Fixed structural role distinguishing the input node as a leaf. */
  readonly composition: "leaf";

  /** Complete Message-domain document retained by reference as Task input. */
  readonly messages: MessageDocument;
}
