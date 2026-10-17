// Copyright © 2026 Mcont.

import {
  isMessageEntry,
  isOpenIdentifier,
  ModelInteractionError,
  type MessageEntry,
  type ToolCall,
} from "@evolutos/mconet-core-domain";

import { mapMessageRoleToWire, mapWireRoleToDomain } from "./map-message-role.js";
import { mapTextMessageContentToWire, mapWireTextToDomain } from "./map-text-message-content.js";
import { OpenAIChatMessageDTO, type OpenAIChatFunctionCall } from "./openai-chat-message-dto.js";

/** Stable code for a request value that is not a message-entry leaf. */
const invalidMessageEntryCode = "invalid_message_entry";

/** Stable code when a tool result does not name the call it answers. */
const missingToolCallIdCode = "missing_tool_call_id";

/** Stable code when tool facts are attached to a role that cannot carry them. */
const unexpectedToolCallCode = "unexpected_tool_call";

/** Role that answers one earlier function call. */
const toolRoleId = "message.tool";

/** Role that may request function calls. */
const assistantRoleId = "message.assistant";

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
 * @returns A message whose wire members are the role, text, and any tool facts.
 * @throws ModelInteractionError When `entry` is not a message-entry leaf, its
 *   role has no wire spelling, any content value is not text, or tool facts do
 *   not belong on that role.
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
  const toolFields = toolFieldsForRequest(entry);

  return new OpenAIChatMessageDTO(role, segments.join(exactContentSeparator), {}, toolFields);
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
 * @throws ModelInteractionError When `role` is not `assistant`, `system`, `tool`, or `user`.
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
  // Copy call facts without parsing argument text. An absent list stays absent
  // so a normal assistant message does not grow an empty toolCalls member.
  const toolCalls = message.toolCalls?.map((call) => domainCall(call));
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
    ...(message.toolCallId === undefined ? {} : { toolCallId: message.toolCallId }),
    ...(toolCalls === undefined ? {} : { toolCalls: Object.freeze(toolCalls) }),
  });
}

/**
 * Returns the tool members that belong on this request entry.
 *
 * A tool result must name its call. Only an assistant entry may request calls.
 * Any other combination fails before a partial message is built.
 *
 * @param entry Validated request entry.
 * @returns Call id or function calls to write, with absent facts omitted.
 */
function toolFieldsForRequest(entry: MessageEntry): {
  readonly toolCallId?: string;
  readonly toolCalls?: readonly OpenAIChatFunctionCall[];
} {
  const toolCallId = entry.toolCallId;
  const toolCalls = entry.toolCalls;
  if (entry.role.id === toolRoleId) {
    // A tool result answers one earlier call. It cannot itself request calls,
    // and the service cannot route the result without the call id.
    if (toolCalls !== undefined) {
      throw toolFactError(
        unexpectedToolCallCode,
        "A tool result must not request further function calls.",
      );
    }
    if (toolCallId === undefined) {
      throw toolFactError(missingToolCallIdCode, "A tool result must name toolCallId.");
    }
    return { toolCallId };
  }
  // A call id belongs only on a tool result. Function calls belong only on
  // the assistant. Any other placement is not a chat-completions message.
  if (toolCallId !== undefined || (toolCalls !== undefined && entry.role.id !== assistantRoleId)) {
    throw toolFactError(
      unexpectedToolCallCode,
      "Tool call facts are only valid on an assistant request or a tool result.",
    );
  }
  if (toolCalls === undefined) {
    return {};
  }
  return {
    toolCalls: toolCalls.map((call) => domainCall(call)),
  };
}

/** Copies one domain call into the wire carrier shape. */
function domainCall(call: ToolCall | OpenAIChatFunctionCall): OpenAIChatFunctionCall {
  // The three wire fields are copied as stored. Argument text is not parsed,
  // and no extra carrier field is introduced.
  return {
    id: call.id,
    name: call.name,
    arguments: call.arguments,
  };
}

/**
 * Returns a protocol-adaptation failure for tool facts that cannot be sent.
 *
 * @param code Stable error code.
 * @param message Technical summary that does not include argument text.
 * @returns The interaction error.
 */
function toolFactError(code: string, message: string): ModelInteractionError {
  // Tool-fact failures are request errors discovered while adapting the
  // protocol, before any bytes are sent.
  return new ModelInteractionError({
    message,
    category: "invalid_request",
    phase: "protocol_adaptation",
    code,
    diagnostics: [],
  });
}
