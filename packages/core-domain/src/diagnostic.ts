// Copyright © 2026 Mcont.

import type { InteractionPhase } from "./interaction-phase.js";
import type { JsonValue } from "./json-value.js";
import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Structured, serializable technical information produced during an interaction.
 *
 * Diagnostics are intended for programmatic handling and troubleshooting, not
 * direct end-user presentation. Optional details remain JSON-only so platform
 * objects, executable values, and opaque secret wrappers cannot enter ordinary
 * diagnostic serialization through this contract.
 */
export interface Diagnostic {
  /** Stable machine-readable diagnostic code. */
  readonly code: string;

  /** Importance of the diagnostic to the interaction outcome. */
  readonly severity: "info" | "warning" | "error";

  /** Interaction pipeline stage that produced the diagnostic. */
  readonly phase: InteractionPhase;

  /** Technical summary suitable for developer troubleshooting. */
  readonly message: string;

  /** Optional path locating the related field or content position. */
  readonly path?: string;

  /** Optional identifier of the service that reported the diagnostic. */
  readonly serviceId?: OpenIdentifier;

  /** Optional platform-neutral structured context safe for JSON serialization. */
  readonly details?: JsonValue;
}
