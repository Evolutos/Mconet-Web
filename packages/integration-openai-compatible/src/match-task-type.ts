// Copyright © 2026 Mcont.

/**
 * Task identity this integration handles.
 *
 * Matching uses this exact spelling. Another conversation-shaped type is not
 * rewritten into it.
 */
export const CONVERSATION_GENERATE_TASK_TYPE = "conversation.generate";

/**
 * Returns whether a task type is conversation generation.
 *
 * Comparison is exact and case-sensitive. A shorter `conversation` id, a
 * longer id, or a non-string does not match.
 *
 * @param taskType Task descriptor `type`.
 * @returns Whether the type is `conversation.generate`.
 */
export function matchesConversationGenerateTask(taskType: string): boolean {
  // Equality is the whole condition. No other type is treated as conversation.
  return taskType === CONVERSATION_GENERATE_TASK_TYPE;
}
