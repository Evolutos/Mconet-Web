// Copyright © 2026 Mcont.

/**
 * Public module boundary for OpenAI-compatible provider integration.
 *
 * Message, request, choice, usage, response, and error wire values are
 * available, along with system, user, assistant, and unknown role mapping,
 * text message content mapping, message-entry mapping, message-document
 * request mapping, and single-choice message mapping. Choice aggregation stays
 * out of this entry until its own step adds it.
 */
export { OpenAIChatCompletionChoiceDTO } from "./openai-chat-completion-choice-dto.js";
export { OpenAIChatCompletionErrorDTO } from "./openai-chat-completion-error-dto.js";
export { OpenAIChatCompletionRequestDTO } from "./openai-chat-completion-request-dto.js";
export { OpenAIChatCompletionResponseDTO } from "./openai-chat-completion-response-dto.js";
export { OpenAIChatCompletionUsageDTO } from "./openai-chat-completion-usage-dto.js";
export { OpenAIChatMessageDTO } from "./openai-chat-message-dto.js";
export {
  mapAssistantMessageRoleToWire,
  mapAssistantWireRoleToDomain,
} from "./map-assistant-message-role.js";
export { mapMessageDocumentToWire } from "./map-message-document.js";
export { mapMessageEntryToWire, mapWireMessageToDomain } from "./map-message-entry.js";
export { mapMessageRoleToWire, mapWireRoleToDomain } from "./map-message-role.js";
export {
  mapSystemMessageRoleToWire,
  mapSystemWireRoleToDomain,
} from "./map-system-message-role.js";
export { mapTextMessageContentToWire, mapWireTextToDomain } from "./map-text-message-content.js";
export { mapWireChoiceToMessageEntry } from "./map-wire-choice.js";
export { mapUserMessageRoleToWire, mapUserWireRoleToDomain } from "./map-user-message-role.js";
