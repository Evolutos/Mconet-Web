// Copyright © 2026 Mcont.

/**
 * Public module boundary for OpenAI-compatible provider integration.
 *
 * Message, request, choice, usage, response, and error wire values are
 * available, along with system, user, assistant, and unknown role mapping,
 * text message content mapping, message-entry mapping, message-document
 * request mapping, single-choice message mapping, choice aggregation, and
 * token-usage mapping, finish-reason mapping, and resolved-model mapping.
 * Adapter matching stays out of this entry until its own step adds it.
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
export { mapChoicesToMessageDocument } from "./map-choices.js";
export { mapWireFinishReasonToDomain } from "./map-finish-reason.js";
export { mapMessageDocumentToWire } from "./map-message-document.js";
export { mapMessageEntryToWire, mapWireMessageToDomain } from "./map-message-entry.js";
export { mapMessageRoleToWire, mapWireRoleToDomain } from "./map-message-role.js";
export { mapWireModelToDomain } from "./map-resolved-model.js";
export {
  mapSystemMessageRoleToWire,
  mapSystemWireRoleToDomain,
} from "./map-system-message-role.js";
export { mapTextMessageContentToWire, mapWireTextToDomain } from "./map-text-message-content.js";
export { mapWireChoiceToMessageEntry } from "./map-wire-choice.js";
export { mapWireUsageToDomain } from "./map-token-usage.js";
export { mapUserMessageRoleToWire, mapUserWireRoleToDomain } from "./map-user-message-role.js";
