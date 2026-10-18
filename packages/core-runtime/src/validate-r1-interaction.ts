// Copyright © 2026 Mcont.

import {
  validateConversationTaskNodeSupport,
  validateConversationTaskTypeSupport,
  validateImageArtifactSupport,
  validateTextInteractionModeSupport,
  type InteractionMode,
  type ProcessingResult,
} from "@evolutos/mconet-core-domain";

import type { InteractionContext } from "./interaction-context.js";

/**
 * Schedules the R1 validators for one normalized interaction.
 *
 * The order is fixed: interaction mode, task type, task nodes, then text and
 * referenced image artifacts. The first failure stops the schedule. This stage
 * does not call a transport, read a credential, or repair the request.
 *
 * @param input Normalized context and the interaction mode to validate.
 * @returns The same context when every gate passes, or diagnostics and no value.
 */
export function validateR1Interaction(input: {
  readonly context: InteractionContext;
  readonly mode: InteractionMode;
}): ProcessingResult<InteractionContext> {
  const modeResult = validateTextInteractionModeSupport(input.mode);
  if (modeResult.value === undefined) {
    // Client stream, duplex, and long-running modes are not executable here.
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

  // Image support runs after mode, task type, and node shape, so a rejected
  // mode does not inspect the catalog. Text and referenced images pass here;
  // other content still fails before a credential is read.
  const imageResult = validateImageArtifactSupport(task.document, task.artifacts);
  if (imageResult.value === undefined) {
    return { diagnostics: imageResult.diagnostics };
  }

  // The normalized context is already the executable request. Do not copy it.
  return { diagnostics: [], value: input.context };
}
