// Copyright © 2026 Mcont.

import type { InteractionExecutionComponents } from "@evolutos/mconet-core-spi";

import { createInteractionExecutionComponents } from "./create-interaction-execution-components.js";

/**
 * Freezes the execution snapshot for one in-flight interaction.
 *
 * Selection, type-contract checks, and capability checks have already succeeded.
 * This stage copies authorization-handler membership and freezes the envelope so
 * a later change to client configuration cannot replace a component while the
 * request is running. It does not select again or call a component.
 *
 * @param input Validated components and resolution facts for this interaction.
 * @returns A new frozen snapshot that retains those component identities.
 */
export function freezeExecutionSnapshot(
  input: InteractionExecutionComponents,
): InteractionExecutionComponents {
  // The factory owns the copy and the freeze. Repeating either here would make
  // two snapshots disagree about which list is isolated.
  return createInteractionExecutionComponents(input);
}
