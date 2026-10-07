// Copyright © 2026 Mcont.

import type { ModelTaskRequest } from "./model-task-request.js";
import type { ProcessingResult } from "./processing-result.js";

/** Exact task identity supported by the current text conversation execution path. */
const supportedTaskType = "conversation.generate";

/**
 * Validates that one structurally valid task request uses the supported task type.
 *
 * This execution-range gate reads only the descriptor type. It does not repeat
 * TaskDescriptor, TaskDocument, Artifact, Message, parameter, interaction-mode,
 * or unknown-node validation; those boundaries remain independent stages. The
 * function never maps an open task identity to conversation generation.
 *
 * @param request Structurally valid open task request to inspect.
 * @returns The original request, or one stable unsupported-task diagnostic.
 */
export function validateConversationTaskTypeSupport(
  request: ModelTaskRequest,
): ProcessingResult<ModelTaskRequest> {
  const taskType = request.descriptor.type;
  if (taskType !== supportedTaskType) {
    // Preserve the exact open identity in portable diagnostic details so callers
    // can explain the failure without inspecting or serializing task contents.
    return {
      diagnostics: [
        {
          code: "unsupported_task",
          severity: "error",
          phase: "validation",
          message: "Only conversation generation is supported by this execution path.",
          path: "descriptor.type",
          details: {
            taskType,
            supportedTaskType,
          },
        },
      ],
    };
  }

  // Successful support checking preserves the complete caller-owned request by
  // identity and produces no warning, default, copy, or normalized descriptor.
  return {
    value: request,
    diagnostics: [],
  };
}
