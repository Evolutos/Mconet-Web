// Copyright © 2026 Mcont.

import type { MessageEntry } from "@evolutos/mconet-core-domain";

import { mapWireMessageToDomain } from "./map-message-entry.js";
import type { OpenAIChatCompletionChoiceDTO } from "./openai-chat-completion-choice-dto.js";
import { childPath } from "./wire.js";

/** JSON Pointer member that holds the choices array. */
const choicesMember = "choices";

/** JSON Pointer member that holds one choice message. */
const choiceMessageMember = "message";

/** JSON Pointer member that holds the message role spelling. */
const messageRoleMember = "role";

/** Prefix for the entry id derived from the choice index. */
const choiceEntryIdPrefix = "choice-";

/** Suffix that distinguishes the single text content from its entry. */
const choiceContentIdSuffix = "-text";

/**
 * Returns the message entry for one response choice.
 *
 * The choice message becomes one entry. Its text stays a single content value,
 * including an empty string, and the role is the message role rather than a
 * forced assistant. The choice index supplies both identities so the same
 * choice always yields the same entry. Finish reason and choice extensions are
 * not copied: finish reason has its own mapping, and extensions are observation
 * data from the wire.
 *
 * @param choice One parsed response choice.
 * @returns A frozen entry whose text is the choice message content.
 * @throws ModelInteractionError When the message role is not `assistant`, `system`, `tool`, or `user`.
 */
export function mapWireChoiceToMessageEntry(choice: OpenAIChatCompletionChoiceDTO): MessageEntry {
  // The role failure names this choice by the index the service assigned.
  const rolePath = childPath(
    childPath(childPath("", choicesMember), String(choice.index)),
    choiceMessageMember,
  );
  return mapWireMessageToDomain(
    choice.message,
    `${choiceEntryIdPrefix}${choice.index}`,
    `${choiceEntryIdPrefix}${choice.index}${choiceContentIdSuffix}`,
    childPath(rolePath, messageRoleMember),
  );
}
