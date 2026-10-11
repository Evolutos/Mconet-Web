// Copyright © 2026 Mcont.

/**
 * Public module boundary for OpenAI-compatible provider integration.
 *
 * Chat message, completion request, choice, and usage wire values are available.
 * Role mapping, response aggregation, and adapter behavior stay out of this
 * entry until their own steps add them.
 */
export { OpenAIChatCompletionChoiceDTO } from "./openai-chat-completion-choice-dto.js";
export { OpenAIChatCompletionRequestDTO } from "./openai-chat-completion-request-dto.js";
export { OpenAIChatCompletionUsageDTO } from "./openai-chat-completion-usage-dto.js";
export { OpenAIChatMessageDTO } from "./openai-chat-message-dto.js";
