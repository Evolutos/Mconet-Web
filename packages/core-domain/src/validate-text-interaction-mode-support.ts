// Copyright © 2026 Mcont.

import type { InteractionMode } from "./interaction-mode.js";
import type { ProcessingResult } from "./processing-result.js";

/** Text interaction modes this release executes. */
const supportedModeIds = ["unary", "server_stream"] as const;

/**
 * Validates that one text interaction mode is executable.
 *
 * Unary is the default exchange: one JSON body comes back. `server_stream` is
 * the other text mode: the service writes Server-Sent Events and the caller
 * can read text as it arrives. Other mode ids stay outside this release.
 * The gate reads only `mode.id`.
 *
 * @param mode Structurally valid open interaction mode to inspect.
 * @returns The original mode, or one stable unsupported-mode diagnostic.
 */
export function validateTextInteractionModeSupport(
  mode: InteractionMode,
): ProcessingResult<InteractionMode> {
  if (!supportedModeIds.includes(mode.id as (typeof supportedModeIds)[number])) {
    return {
      diagnostics: [
        {
          code: "unsupported_interaction_mode",
          severity: "error",
          phase: "validation",
          message: "Text interaction supports unary and server_stream.",
          path: "id",
          details: {
            modeId: mode.id,
            supportedModeIds: [...supportedModeIds],
          },
        },
      ],
    };
  }

  return {
    value: mode,
    diagnostics: [],
  };
}
