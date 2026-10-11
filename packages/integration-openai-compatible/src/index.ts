// Copyright © 2026 Mcont.

/**
 * Public module boundary for OpenAI-compatible provider integration.
 *
 * Message, request, choice, usage, response, and error wire values are
 * available, along with system, user, assistant, and unknown role mapping and
 * text message content mapping. Entry, document, and response mapping stay out
 * of this entry until their own steps add them.
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
export { mapMessageRoleToWire, mapWireRoleToDomain } from "./map-message-role.js";
export {
  mapSystemMessageRoleToWire,
  mapSystemWireRoleToDomain,
} from "./map-system-message-role.js";
export { mapTextMessageContentToWire, mapWireTextToDomain } from "./map-text-message-content.js";
export { mapUserMessageRoleToWire, mapUserWireRoleToDomain } from "./map-user-message-role.js";
