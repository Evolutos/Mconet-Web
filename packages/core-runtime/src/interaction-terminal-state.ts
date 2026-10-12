// Copyright © 2026 Mcont.

import type { ModelInteractionError, ModelOutput } from "@evolutos/mconet-core-domain";

/**
 * One finished interaction.
 *
 * The three variants are mutually exclusive: a completed output, a classified
 * error, or a cancellation. A value cannot carry an output and an error
 * together, and cancellation does not invent an output.
 */
export type InteractionTerminalState =
  | {
      /** The interaction produced a public output. */
      readonly kind: "complete";
      /** Public output assembled for the caller. */
      readonly output: ModelOutput;
    }
  | {
      /** The interaction failed with a classified error. */
      readonly kind: "error";
      /** Classified failure. Its cause may hold an unclassified exception. */
      readonly error: ModelInteractionError;
    }
  | {
      /** The interaction was cancelled. */
      readonly kind: "cancel";
      /** Cancellation reason retained without being copied into an output. */
      readonly reason?: unknown;
    };
