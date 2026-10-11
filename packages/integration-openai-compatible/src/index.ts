// Copyright © 2026 Mcont.

/**
 * Public module boundary for OpenAI-compatible provider integration.
 *
 * Chat message and completion request wire values are available. Role mapping,
 * response parsing, and adapter behavior stay out of this entry until their
 * own steps add them.
 */
export { OpenAIChatCompletionRequestDTO } from "./openai-chat-completion-request-dto.js";
export { OpenAIChatMessageDTO } from "./openai-chat-message-dto.js";
