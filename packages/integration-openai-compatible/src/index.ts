// Copyright © 2026 Mcont.

/**
 * Public module boundary for OpenAI-compatible provider integration.
 *
 * Message, request, choice, usage, response, and error wire values are
 * available, along with system, user, assistant, and unknown role mapping,
 * text message content mapping, message-entry mapping, message-document
 * request mapping, single-choice message mapping, choice aggregation, and
 * token-usage mapping, finish-reason mapping, resolved-model mapping, and
 * protocol-id matching, task-type matching, unary mode matching, and
 * chat-completion plan preparation, temperature mapping, top-p mapping, and
 * max-output-token mapping, stop-sequence mapping, seed mapping, and
 * unencoded request building, success-response parsing, and authentication
 * error mapping, and rate-limit error mapping. Content-filter error mapping
 * stays out of this entry until its own step adds it.
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
export { buildOpenAIChatCompletionRequest } from "./build-chat-completion-request.js";
export { mapAuthenticationError } from "./map-authentication-error.js";
export { mapChoicesToMessageDocument } from "./map-choices.js";
export { mapWireFinishReasonToDomain } from "./map-finish-reason.js";
export { mapMaxOutputTokensToWire } from "./map-max-output-tokens.js";
export type { MappedMaxOutputTokens } from "./map-max-output-tokens.js";
export { mapMessageDocumentToWire } from "./map-message-document.js";
export {
  matchesUnaryInteractionMode,
  UNARY_INTERACTION_MODE_ID,
} from "./match-interaction-mode.js";
export {
  matchesOpenAIChatCompletionsProtocol,
  OPENAI_CHAT_COMPLETIONS_PROTOCOL_ID,
} from "./match-protocol-id.js";
export {
  CONVERSATION_GENERATE_TASK_TYPE,
  matchesConversationGenerateTask,
} from "./match-task-type.js";
export { mapMessageEntryToWire, mapWireMessageToDomain } from "./map-message-entry.js";
export { mapMessageRoleToWire, mapWireRoleToDomain } from "./map-message-role.js";
export { mapRateLimitError } from "./map-rate-limit-error.js";
export { mapWireModelToDomain } from "./map-resolved-model.js";
export { mapSeedToWire } from "./map-seed.js";
export type { MappedSeed } from "./map-seed.js";
export {
  mapSystemMessageRoleToWire,
  mapSystemWireRoleToDomain,
} from "./map-system-message-role.js";
export { mapStopSequencesToWire } from "./map-stop-sequences.js";
export type { MappedStopSequences } from "./map-stop-sequences.js";
export { mapTextMessageContentToWire, mapWireTextToDomain } from "./map-text-message-content.js";
export { mapTemperatureToWire } from "./map-temperature.js";
export type { MappedTemperature } from "./map-temperature.js";
export { mapTopPToWire } from "./map-top-p.js";
export type { MappedTopP } from "./map-top-p.js";
export { mapWireChoiceToMessageEntry } from "./map-wire-choice.js";
export { parseOpenAIChatCompletionResponse } from "./parse-chat-completion-response.js";
export {
  OPENAI_CHAT_REQUEST_TYPE_ID,
  OPENAI_CHAT_RESPONSE_TYPE_ID,
  prepareOpenAIChatCompletionPlan,
} from "./prepare-chat-completion-plan.js";
export { mapWireUsageToDomain } from "./map-token-usage.js";
export { mapUserMessageRoleToWire, mapUserWireRoleToDomain } from "./map-user-message-role.js";
