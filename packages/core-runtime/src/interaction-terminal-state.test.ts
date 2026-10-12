// Copyright © 2026 Mcont.

import type { ModelInteractionError, ModelOutput } from "@evolutos/mconet-core-domain";
import { expectTypeOf, it } from "vitest";

import type { InteractionTerminalState } from "./interaction-terminal-state.js";

it("keeps complete, error, and cancel mutually exclusive", () => {
  expectTypeOf<InteractionTerminalState>().toEqualTypeOf<
    | { readonly kind: "complete"; readonly output: ModelOutput }
    | { readonly kind: "error"; readonly error: ModelInteractionError }
    | { readonly kind: "cancel"; readonly reason?: unknown }
  >();
  expectTypeOf<Extract<InteractionTerminalState, { kind: "complete" }>>().not.toHaveProperty(
    "error",
  );
  expectTypeOf<Extract<InteractionTerminalState, { kind: "error" }>>().not.toHaveProperty("output");
  expectTypeOf<Extract<InteractionTerminalState, { kind: "cancel" }>>().not.toHaveProperty(
    "output",
  );
});
