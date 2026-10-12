// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import { expect, it } from "vitest";

import { createInteractionTermination } from "./create-interaction-termination.js";
import type { InteractionTerminalState } from "./interaction-terminal-state.js";

const complete = {
  kind: "complete",
  output: { status: "completed" },
} as InteractionTerminalState & { kind: "complete" };
const cancel: InteractionTerminalState = { kind: "cancel", reason: "caller" };

it("records the first terminal state and rejects a second one", () => {
  const termination = createInteractionTermination();

  expect(termination.terminate(complete)).toBe(complete);
  expect(termination.current()).toBe(complete);

  const error = captureInteractionError(() => {
    termination.terminate(cancel);
  });

  expect(error.code).toBe("interaction_already_terminated");
  expect(termination.current()).toBe(complete);
});

function captureInteractionError(action: () => void): ModelInteractionError {
  try {
    action();
  } catch (caught) {
    if (caught instanceof ModelInteractionError) {
      return caught;
    }
    throw caught;
  }
  throw new Error("Expected a model interaction error.");
}
