// Copyright © 2026 Mcont.

/**
 * Protocol identity this integration handles.
 *
 * Matching uses this exact spelling. A model name or endpoint never selects it.
 */
export const OPENAI_CHAT_COMPLETIONS_PROTOCOL_ID = "openai.chat.completions";

/**
 * Returns whether a target protocol id is this chat-completions protocol.
 *
 * Comparison is exact and case-sensitive. A prefix, suffix, or different
 * protocol id does not match, and a non-string does not match. The function
 * does not inspect a model name.
 *
 * @param protocolId Target `protocolId`.
 * @returns Whether the id is `openai.chat.completions`.
 */
export function matchesOpenAIChatCompletionsProtocol(protocolId: string): boolean {
  // Equality rejects lookalikes such as a longer id or a different case.
  return protocolId === OPENAI_CHAT_COMPLETIONS_PROTOCOL_ID;
}
