// Copyright © 2026 Mcont.

import {
  isMessageDocument,
  ModelInteractionError,
  type ArtifactCatalog,
  type MessageDocument,
  type MessageEntry,
  type MessageGroup,
} from "@evolutos/mconet-core-domain";

import { mapMessageEntryToWire } from "./map-message-entry.js";
import type { OpenAIChatMessageDTO } from "./openai-chat-message-dto.js";

/** Stable code for a request value that is not a complete message document. */
const invalidMessageDocumentCode = "invalid_message_document";

/** Leaf discriminator. Groups use another kind and are not themselves messages. */
const messageEntryKind = "message.entry";

/** Message-tree element visited while collecting request messages. */
type MessageElement = MessageGroup | MessageEntry;

/** Empty catalog used when a caller maps a text-only document. */
const emptyCatalog: ArtifactCatalog = Object.freeze({ artifacts: Object.freeze([]) });

/**
 * Returns request chat messages for one message document.
 *
 * Entries are visited in document preorder, so nested groups keep the author's
 * turn order instead of being sorted or flattened by role. Each entry becomes
 * one message through the entry mapper. Version, purpose, metadata, extensions,
 * and group containers are not wire messages, and this function does not choose
 * a model or sampling parameters.
 *
 * @param document Request message tree.
 * @param catalog Catalog that resolves image references in the document.
 * @returns Frozen messages in send order. The list is empty when the tree has no entries.
 * @throws ModelInteractionError When `document` is not a valid message document,
 *   an entry role has no wire spelling, or any content value cannot be sent.
 */
export function mapMessageDocumentToWire(
  document: MessageDocument,
  catalog: ArtifactCatalog = emptyCatalog,
): readonly OpenAIChatMessageDTO[] {
  // The document guard checks the whole tree, including nested identity and
  // relations, before any entry is turned into a message.
  if (!isMessageDocument(document)) {
    throw new ModelInteractionError({
      message: "Message document is not a valid message tree.",
      category: "invalid_request",
      phase: "protocol_adaptation",
      code: invalidMessageDocumentCode,
      diagnostics: [],
    });
  }

  const messages: OpenAIChatMessageDTO[] = [];
  const pending: MessageElement[] = [document.root];
  // Pop until the stack reports exhaustion so an empty tree stays in normal flow.
  let element = pending.pop();
  while (element !== undefined) {
    if (isEntry(element)) {
      // One leaf is one turn. Content order inside that turn belongs to the entry mapper.
      messages.push(mapMessageEntryToWire(element, catalog));
    } else {
      // Reverse a shallow copy so the stack restores left-to-right child order.
      // The document's own children array is not reversed or otherwise modified.
      for (const child of element.children.slice().reverse()) {
        pending.push(child);
      }
    }
    element = pending.pop();
  }

  // Freeze the list so a caller cannot reorder turns after mapping.
  return Object.freeze(messages);
}

/** Narrows one visited element to a leaf entry. */
function isEntry(element: MessageElement): element is MessageEntry {
  // A valid group cannot use the entry kind, so the discriminator is enough
  // after the document guard has accepted the tree.
  return element.kind === messageEntryKind;
}
