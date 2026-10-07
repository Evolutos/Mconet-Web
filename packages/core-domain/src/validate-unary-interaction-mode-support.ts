// Copyright © 2026 Mcont.

import type { InteractionMode } from "./interaction-mode.js";
import type { ProcessingResult } from "./processing-result.js";

/** Exact interaction mode supported by the current non-streaming execution path. */
const supportedModeId = "unary";

/**
 * Validates that one structurally valid interaction mode is currently supported.
 *
 * The gate reads only the open mode identity. It does not infer mode from task,
 * protocol, transport, payload, callback, stream, or operation state and does
 * not select or construct any Runtime component.
 *
 * @param mode Structurally valid open interaction mode to inspect.
 * @returns The original unary mode, or one stable unsupported-mode diagnostic.
 */
export function validateUnaryInteractionModeSupport(
  mode: InteractionMode,
): ProcessingResult<InteractionMode> {
  if (mode.id !== supportedModeId) {
    // Retain the exact unsupported open identity without reading unrelated
    // execution state or collapsing future modes into a generic unknown value.
    return {
      diagnostics: [
        {
          code: "unsupported_interaction_mode",
          severity: "error",
          phase: "validation",
          message: "Only unary interaction mode is supported by this execution path.",
          path: "id",
          details: {
            modeId: mode.id,
            supportedModeId,
          },
        },
      ],
    };
  }

  // Preserve the exact caller-owned mode value and add no defaults, transport
  // selection, task assumptions, or shared mutable result state.
  return {
    value: mode,
    diagnostics: [],
  };
}
