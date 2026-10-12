// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

import type { InteractionTerminalState } from "./interaction-terminal-state.js";

/** Stable code when a second termination is attempted. */
const alreadyTerminatedCode = "interaction_already_terminated";

/**
 * One interaction's terminate-once state machine.
 *
 * The first terminal state is stored. A later call fails and leaves the first
 * state in place, whether the second attempt is completion, an error, or
 * cancellation.
 */
export interface InteractionTermination {
  /** Records the first terminal state. */
  terminate(state: InteractionTerminalState): InteractionTerminalState;
  /** Returns the recorded state, if termination has happened. */
  current(): InteractionTerminalState | undefined;
}

/**
 * Creates a terminate-once machine for one interaction.
 *
 * @returns A machine with no terminal state yet.
 */
export function createInteractionTermination(): InteractionTermination {
  let terminal: InteractionTerminalState | undefined;

  return {
    terminate(state: InteractionTerminalState): InteractionTerminalState {
      if (terminal !== undefined) {
        throw new ModelInteractionError({
          message: "The interaction has already terminated.",
          category: "invalid_request",
          phase: "validation",
          code: alreadyTerminatedCode,
          diagnostics: [
            {
              code: alreadyTerminatedCode,
              severity: "error",
              phase: "validation",
              message: "A second terminal state was rejected.",
              details: { existingKind: terminal.kind, rejectedKind: state.kind },
            },
          ],
        });
      }
      terminal = state;
      return state;
    },
    current(): InteractionTerminalState | undefined {
      return terminal;
    },
  };
}
