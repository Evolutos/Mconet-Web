// Copyright © 2026 Mcont.

import {
  MessageDocumentBuilder,
  ModelInteractionError,
  type MessageDocument,
  type MessageEntry,
  type MessageGroup,
} from "@evolutos/mconet-core-domain";

import { mapWireChoiceToMessageEntry } from "./map-wire-choice.js";
import { OpenAIChatCompletionChoiceDTO } from "./openai-chat-completion-choice-dto.js";

/** Stable code for a success body that contains no choice. */
const emptyChoicesCode = "empty_choices";

/** Stable code for two choices that claim the same index. */
const duplicateChoiceIndexCode = "duplicate_choice_index";

/** Message schema version written on every aggregated output document. */
const messageDocumentVersion = "1.0";

/** Purpose of a document built from response choices. */
const outputPurpose = "output";

/** Root identity. It is not derived from a choice index, so it cannot collide with `choice-N`. */
const outputRootId = "output";

/** Root kind required by the message document contract. */
const messageRootKind = "message.root";

/** Container composition required on every message group. */
const containerComposition = "container";

/** Shared empty relations for the output root. */
const emptyRelations: MessageGroup["relations"] = Object.freeze([]);

/** Shared empty metadata for the output root. */
const emptyMetadata: MessageGroup["metadata"] = Object.freeze({});

/** Shared empty extensions for the output root. */
const emptyExtensions: MessageGroup["extensions"] = Object.freeze({});

/**
 * Aggregates response choices into one output message document.
 *
 * The policy is fixed:
 * - an empty list fails, because a conversation result needs a message;
 * - one choice becomes the only child of the output root;
 * - several choices all become sibling entries in the service's array order.
 *
 * Entries are not sorted by `index`, and their texts are not joined into one
 * entry. Two choices with the same index fail, because each entry id comes
 * from that index. Finish reason, usage, and the response model are not read.
 *
 * @param choices Choices in the order the service sent them.
 * @returns A validated output document.
 * @throws ModelInteractionError When `choices` is empty, two choices share an
 *   index, or a choice message role is not `assistant`, `system`, or `user`.
 */
export function mapChoicesToMessageDocument(
  choices: readonly OpenAIChatCompletionChoiceDTO[],
): MessageDocument {
  // An empty success body is not an empty conversation. Fail before building a document.
  if (choices.length === 0) {
    throw new ModelInteractionError({
      message: "OpenAI-compatible response choices must contain at least one choice.",
      category: "protocol",
      phase: "response_parsing",
      code: emptyChoicesCode,
      diagnostics: [],
    });
  }

  const children: MessageEntry[] = [];
  const seenIndexes = new Set<number>();
  for (const choice of choices) {
    // Only a parsed choice has a validated index and message. A lookalike object
    // must not be read as one.
    if (!(choice instanceof OpenAIChatCompletionChoiceDTO)) {
      throw new TypeError("Choices must contain OpenAIChatCompletionChoiceDTO values.");
    }
    // Entry ids are `choice-<index>`. A repeated index cannot both be kept.
    if (seenIndexes.has(choice.index)) {
      throw new ModelInteractionError({
        message: `OpenAI-compatible response choice index ${choice.index} is duplicated.`,
        category: "protocol",
        phase: "response_parsing",
        code: duplicateChoiceIndexCode,
        diagnostics: [],
      });
    }
    seenIndexes.add(choice.index);
    // Service array order, not index order, is the sibling order.
    children.push(mapWireChoiceToMessageEntry(choice));
  }

  const root: MessageGroup = {
    id: outputRootId,
    kind: messageRootKind,
    composition: containerComposition,
    children,
    relations: emptyRelations,
    metadata: emptyMetadata,
    extensions: emptyExtensions,
  };
  // The builder applies the document contract, including distinct element ids.
  return new MessageDocumentBuilder(messageDocumentVersion, outputPurpose, root).build();
}
