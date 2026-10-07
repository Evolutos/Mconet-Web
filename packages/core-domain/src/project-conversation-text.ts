// Copyright © 2026 Mcont.

import type { ConversationTaskResult } from "./conversation-task-result.js";
import type { MessageEntry } from "./message-entry.js";
import type { MessageGroup } from "./message-group.js";
import { isTextMessageContent } from "./text-message-content.js";

/** Message-tree element accepted by the projection traversal. */
type MessageElement = MessageGroup | MessageEntry;

/** Standard role identity that is authoritative for assistant output. */
const assistantRoleId = "message.assistant";

/**
 * Projects assistant text from a conversation task result without mutation.
 *
 * Elements are visited in document preorder, and content within each assistant
 * entry retains its declared order. Standard text segments are concatenated
 * exactly with no inserted separator, trimming, or Unicode normalization. Other
 * roles and non-text assistant content remain available through the authoritative
 * MessageDocument but do not enter this convenience view.
 *
 * The input is expected to contain a valid MessageDocument. This projection does
 * not repeat whole-document validation or infer text from unknown content.
 *
 * @param result Conversation result containing the authoritative Message tree.
 * @returns Stable assistant text, or an empty string when no segment qualifies.
 */
export function projectConversationText(result: ConversationTaskResult): string {
  const segments: string[] = [];
  const pending: MessageElement[] = [result.messages.root];

  // An explicit stack avoids recursion-depth dependence. Reading until pop
  // reports exhaustion keeps the stack's empty state inside normal control flow.
  let element = pending.pop();
  while (element !== undefined) {
    if (isEntry(element)) {
      // Role identity alone selects assistant output. An integration-defined role
      // cannot opt in through semantic hints or provider-specific raw values.
      if (element.role.id === assistantRoleId) {
        for (const content of element.content) {
          // Reuse the concrete content guard so unknown or future values are never
          // coerced through kind strings, raw bytes, metadata, or object display.
          if (isTextMessageContent(content)) {
            segments.push(content.text);
          }
        }
      }
    } else {
      // Reverse a shallow collection copy, never the authoritative children array.
      // Individual pushes avoid an unbounded argument list, while the LIFO stack
      // subsequently restores the source's declared left-to-right preorder.
      for (const child of element.children.slice().reverse()) {
        pending.push(child);
      }
    }

    // Read the next available element after any children have joined the stack;
    // undefined terminates only when the traversal is fully exhausted.
    element = pending.pop();
  }

  // Empty-separator joining preserves producer-owned whitespace, line endings,
  // empty segments, Unicode code points, and text-delta concatenation semantics.
  return segments.join("");
}

/** Narrows one valid Message element to the fixed entry discriminator. */
function isEntry(element: MessageElement): element is MessageEntry {
  // Valid MessageGroup values cannot use the reserved entry kind, so the fixed
  // discriminator is sufficient after the enclosing document boundary succeeds.
  return element.kind === "message.entry";
}
