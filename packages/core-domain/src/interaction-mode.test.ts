// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { InteractionMode } from "./interaction-mode.js";
import type { OpenIdentifier } from "./open-identifier.js";

/** Standard interaction mode identities defined by the language-neutral architecture. */
const standardInteractionModeIds = [
  "unary",
  "server_stream",
  "client_stream",
  "duplex",
  "long_running",
] as const;

it("defines only the immutable open interaction mode identity", () => {
  // Exact equality prevents task type, transport, protocol, state, policy,
  // capability, or runtime behavior from entering this identity abstraction.
  expectTypeOf<InteractionMode>().toEqualTypeOf<{
    readonly id: OpenIdentifier;
  }>();
});

it("expresses every standard mode through the same open interface", () => {
  const modes: readonly InteractionMode[] = standardInteractionModeIds.map(
    (id): InteractionMode => {
      // Wrap each reviewed identity without attaching transport selection,
      // streaming machinery, or claims about runtime support.
      return { id };
    },
  );

  // Preserve the complete standard vocabulary and order as ordinary open data.
  expect(modes.map(readInteractionModeId)).toEqual(standardInteractionModeIds);
});

it("preserves an integration-defined mode without changing task identity", () => {
  const mode: InteractionMode = {
    id: "provider.deferred_stream",
  };
  const taskType: OpenIdentifier = "conversation.generate";

  // Separate values demonstrate that execution mode neither replaces nor
  // decorates the independent task-family identity.
  expect(mode).toEqual({ id: "provider.deferred_stream" });
  expect(taskType).toBe("conversation.generate");
});

it("requires the mode identity at compile time", () => {
  // No empty object or unrelated task field can stand in for the one required
  // open identifier carried by InteractionMode.
  expectTypeOf<Record<never, never>>().not.toMatchTypeOf<InteractionMode>();
  expectTypeOf<{ readonly type: OpenIdentifier }>().not.toMatchTypeOf<InteractionMode>();
});

it("prevents interaction mode replacement at compile time", () => {
  const proveReadonly = (mode: InteractionMode): void => {
    // This forbidden assignment is compiled but never executed, proving that
    // callers cannot mutate a selected execution mode in place.
    // @ts-expect-error Interaction mode identity cannot be replaced.
    mode.id = "unary";
  };

  // Keep the helper reachable so strict TypeScript checks its readonly write.
  expectTypeOf(proveReadonly).toBeFunction();
});

/** Returns one already typed mode identity for the ordered vocabulary assertion. */
function readInteractionModeId(mode: InteractionMode): OpenIdentifier {
  // Reading preserves the exact case and spelling; no normalization or support
  // lookup occurs at this pure type-contract boundary.
  return mode.id;
}
