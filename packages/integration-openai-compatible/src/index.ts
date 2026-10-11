// Copyright © 2026 Mcont.

/**
 * Public module boundary for OpenAI-compatible provider integration.
 *
 * The chat message wire value is the first protocol carrier. Role mapping,
 * request assembly, and adapter behavior stay out of this entry until their
 * own steps add them.
 */
export { OpenAIChatMessageDTO } from "./openai-chat-message-dto.js";
