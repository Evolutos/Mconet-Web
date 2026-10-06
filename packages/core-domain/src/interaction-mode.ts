// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Immutable open identity describing how one task interaction is executed.
 *
 * Mode is independent from the TaskDescriptor that defines what work is being
 * requested. Standard and integration-defined identities share this same shape.
 * The interface carries no task type, transport, protocol, streaming state,
 * runtime component, capability claim, policy, or execution behavior.
 */
export interface InteractionMode {
  /** Standard or integration-defined interaction execution mode. */
  readonly id: OpenIdentifier;
}
