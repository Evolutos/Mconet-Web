// Copyright © 2026 Mcont.

import {
  isModelRequest,
  type ModelRequest,
  type ProcessingResult,
} from "@evolutos/mconet-core-domain";

import { createInteractionContext, type InteractionContext } from "./interaction-context.js";

/** Stable code when the interaction request is not a model request envelope. */
const invalidModelRequestCode = "invalid_model_request";

/**
 * Schedules normalization of the request carried by one interaction context.
 *
 * A valid envelope becomes a new frozen request. Nested target, task, access,
 * metadata, and extensions keep their original identities, and no field is
 * trimmed, inferred, or replaced. An invalid envelope returns one diagnostic
 * and no context. This stage does not read credentials, select components, or
 * call a transport.
 *
 * @param context Per-request context whose request is normalized.
 * @returns A context carrying the frozen request, or diagnostics and no value.
 */
export function normalizeInteractionRequest(
  context: InteractionContext,
): ProcessingResult<InteractionContext> {
  const request = context?.request;
  if (!isModelRequest(request)) {
    // Refuse before any later stage can treat a partial object as executable.
    return {
      diagnostics: [
        {
          code: invalidModelRequestCode,
          severity: "error",
          phase: "validation",
          message: "Interaction request must be a model request.",
          path: "request",
        },
      ],
    };
  }

  // Copy only the envelope. Present access stays present; true absence stays absent.
  const normalized = Object.freeze({
    target: request.target,
    task: request.task,
    ...(Object.hasOwn(request, "serviceAccess") ? { serviceAccess: request.serviceAccess } : {}),
    metadata: request.metadata,
    extensions: request.extensions,
  }) satisfies ModelRequest;

  return {
    diagnostics: [],
    value: createInteractionContext({
      request: normalized,
      options: context.options,
    }),
  };
}
