// Copyright © 2026 Mcont.

import type { ConversationTaskResult } from "./conversation-task-result.js";
import type { MessageEntry } from "./message-entry.js";
import type { MessageGroup } from "./message-group.js";
import type { ToolCall } from "./tool-call.js";

/** Message-tree element accepted by the projection traversal. */
type MessageElement = MessageGroup | MessageEntry;

/** Standard role identity that is authoritative for assistant output. */
const assistantRoleId = "message.assistant";

/**
 * Projects assistant function calls from a conversation result without mutation.
 *
 * Entries are visited in document preorder. Calls inside one assistant entry
 * keep their declared order. Other roles stay in the message document and do
 * not enter this list. The function does not parse argument text or execute a
 * function.
 *
 * @param result Conversation result containing the authoritative message tree.
 * @returns Assistant tool calls, or an empty list when the assistant asked for none.
 */
export function projectConversationToolCalls(result: ConversationTaskResult): readonly ToolCall[] {
  const calls: ToolCall[] = [];
  // An explicit stack keeps preorder independent of recursion depth.
  const pending: MessageElement[] = [result.messages.root];
  let element = pending.pop();
  while (element !== undefined) {
    if (isEntry(element)) {
      // Role identity alone selects assistant calls. A tool-result turn carries
      // an id, not a new request for the application to run. Calls stay in the
      // order declared on that entry.
      if (element.role.id === assistantRoleId && element.toolCalls !== undefined) {
        for (const call of element.toolCalls) {
          calls.push(call);
        }
      }
    } else {
      // Reverse a copy so the stack restores left-to-right child order.
      for (const child of element.children.slice().reverse()) {
        pending.push(child);
      }
    }
    element = pending.pop();
  }
  return calls;
}

/** Narrows one valid message element to the fixed entry discriminator. */
function isEntry(element: MessageElement): element is MessageEntry {
  // Kind is the fixed discriminator. Container nodes use a different kind and
  // are walked through their children instead.
  return element.kind === "message.entry";
}
