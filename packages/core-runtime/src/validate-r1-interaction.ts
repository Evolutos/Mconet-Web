// Copyright © 2026 Mcont.

import {
  validateConversationTaskNodeSupport,
  validateConversationTaskTypeSupport,
  validateEmptyArtifactCatalogSupport,
  validateTextMessageContentSupport,
  validateUnaryInteractionModeSupport,
  type ConversationInputNode,
  type InteractionMode,
  type ProcessingResult,
  type TaskDocument,
  type TaskNode,
} from "@evolutos/mconet-core-domain";

import type { InteractionContext } from "./interaction-context.js";

/** Conversation input leaf. Other leaves are not message sources. */
const conversationInputKind = "task.input.conversation";

/** Container composition. Groups are walked; they are not themselves messages. */
const containerComposition = "container";

/**
 * Schedules the R1 validators for one normalized interaction.
 *
 * The order is fixed: interaction mode, task type, task nodes, text content,
 * then an empty artifact catalog. The first failure stops the schedule. This
 * stage does not call a transport, read a credential, or repair the request.
 *
 * @param input Normalized context and the interaction mode to validate.
 * @returns The same context when every gate passes, or diagnostics and no value.
 */
export function validateR1Interaction(input: {
  readonly context: InteractionContext;
  readonly mode: InteractionMode;
}): ProcessingResult<InteractionContext> {
  const modeResult = validateUnaryInteractionModeSupport(input.mode);
  if (modeResult.value === undefined) {
    // A non-unary mode is not executable. Later gates are not consulted.
    return { diagnostics: modeResult.diagnostics };
  }

  const task = input.context.request.task;
  const taskTypeResult = validateConversationTaskTypeSupport(task);
  if (taskTypeResult.value === undefined) {
    return { diagnostics: taskTypeResult.diagnostics };
  }

  const nodeResult = validateConversationTaskNodeSupport(task.document);
  if (nodeResult.value === undefined) {
    return { diagnostics: nodeResult.diagnostics };
  }

  const textResult = validateConversationText(task.document);
  if (textResult !== undefined) {
    return textResult;
  }

  const artifactResult = validateEmptyArtifactCatalogSupport(task.artifacts);
  if (artifactResult.value === undefined) {
    return { diagnostics: artifactResult.diagnostics };
  }

  // The normalized context is already the executable request. Do not copy it.
  return { diagnostics: [], value: input.context };
}

/**
 * Validates text content in every conversation input, in preorder.
 *
 * @param document Task document whose conversation leaves carry messages.
 * @returns Diagnostics when a message contains non-text content.
 */
function validateConversationText(
  document: TaskDocument,
): ProcessingResult<InteractionContext> | undefined {
  const pending: TaskNode[] = [document.root];
  let node = pending.pop();
  while (node !== undefined) {
    if (isConversationInput(node)) {
      const textResult = validateTextMessageContentSupport(node.messages);
      if (textResult.value === undefined) {
        return { diagnostics: textResult.diagnostics };
      }
    } else if (node.composition === containerComposition && "children" in node) {
      // Reverse a shallow copy so the stack restores left-to-right child order.
      for (const child of node.children.slice().reverse()) {
        pending.push(child);
      }
    }
    node = pending.pop();
  }
  return undefined;
}

/** Narrows one task node to a conversation input leaf. */
function isConversationInput(node: TaskNode): node is ConversationInputNode {
  return node.kind === conversationInputKind && node.composition === "leaf";
}
