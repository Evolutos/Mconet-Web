// Copyright © 2026 Mcont.

import {
  isMessageEntry,
  isOpenIdentifier,
  ModelInteractionError,
  type MessageEntry,
} from "@evolutos/mconet-core-domain";

import { mapMessageRoleToWire, mapWireRoleToDomain } from "./map-message-role.js";
import { mapTextMessageContentToWire, mapWireTextToDomain } from "./map-text-message-content.js";
import { OpenAIChatMessageDTO } from "./openai-chat-message-dto.js";

/** Stable code for a request value that is not a message-entry leaf. */
const invalidMessageEntryCode = "invalid_message_entry";

/** Fixed discriminator written on every entry this mapper creates. */
const messageEntryKind = "message.entry";

/**
 * Nothing is inserted between ordered text segments.
 *
 * The chat message has one string slot. Joining with an empty separator keeps
 * each segment's own spaces, line breaks, and empty text, matching the
 * conversation text projection.
 */
const exactContentSeparator = "";

/** Shared empty relations. Frozen so one created entry cannot add a relation to another. */
const emptyRelations: MessageEntry["relations"] = Object.freeze([]);

/** Shared empty metadata. Frozen so one created entry cannot alter another. */
const emptyMetadata: MessageEntry["metadata"] = Object.freeze({});

/** Shared empty extensions. Frozen for the same reason as the metadata. */
const emptyExtensions: MessageEntry["extensions"] = Object.freeze({});

/**
 * Returns the chat message for one request entry.
 *
 * Role and content are mapped by their own steps. Content values stay in
 * declared order and are joined into the single wire string. Relations,
 * metadata, and extensions stay on the domain entry: the frozen message shape
 * has no members for them, and this function does not copy them into extensions
 * because a request must not send unknown members.
 *
 * @param entry One leaf of a request message document.
 * @returns A message whose `role` and `content` are the only wire members.
 * @throws ModelInteractionError When `entry` is not a message-entry leaf, its
 *   role has no wire spelling, or any content value is not text.
 */
export function mapMessageEntryToWire(entry: MessageEntry): OpenAIChatMessageDTO {
  // The domain guard rejects containers, accessors, and an empty content list
  // before any text is read. A lookalike object must not be concatenated.
  if (!isMessageEntry(entry)) {
    throw new ModelInteractionError({
      message: "Message entry is not a valid message.entry leaf.",
      category: "invalid_request",
      phase: "protocol_adaptation",
      code: invalidMessageEntryCode,
      diagnostics: [],
    });
  }

  // Role is selected before content so an unsupported participant fails without
  // depending on how many content values follow it.
  const role = mapMessageRoleToWire(entry.role);
  const segments: string[] = [];
  for (const content of entry.content) {
    // Index order is the content order. A non-text value fails inside the
    // content mapper and leaves no partial message to send.
    segments.push(mapTextMessageContentToWire(content));
  }

  return new OpenAIChatMessageDTO(role, segments.join(exactContentSeparator));
}

/**
 * Creates one message entry for a response chat message.
 *
 * The wire string becomes a single text content value. It is not split on
 * spaces or line breaks, because those characters are part of the text. The
 * caller supplies both identities so the same response always yields the same
 * entry. Wire extensions are not copied onto the domain entry.
 *
 * @param message Parsed chat message.
 * @param entryId Document-local identity for the entry.
 * @param contentId Document-local identity for its single text content.
 * @param rolePath JSON Pointer of the message `role` member, used only when the spelling is rejected.
 * @returns A frozen entry with one content value and empty relations, metadata, and extensions.
 * @throws ModelInteractionError When `role` is not `assistant`, `system`, or `user`.
 * @throws TypeError When either identity is not an open identifier.
 */
export function mapWireMessageToDomain(
  message: OpenAIChatMessageDTO,
  entryId: string,
  contentId: string,
  rolePath: string,
): MessageEntry {
  // Both identities are stored on the entry. Rejecting a malformed one here
  // keeps the returned value inside the message-entry contract.
  if (!isOpenIdentifier(entryId) || !isOpenIdentifier(contentId)) {
    throw new TypeError("Message entry and content ids must be open identifiers.");
  }

  const role = mapWireRoleToDomain(message.role, rolePath);
  const content = mapWireTextToDomain(message.content, contentId);
  // One wire string is one content value. Freezing the array preserves that
  // order and stops a later reader from inserting another segment.
  return Object.freeze({
    id: entryId,
    kind: messageEntryKind,
    role,
    content: Object.freeze([content]),
    relations: emptyRelations,
    metadata: emptyMetadata,
    extensions: emptyExtensions,
  });
}
