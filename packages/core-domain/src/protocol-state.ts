// Copyright © 2026 Mcont.

import type { JsonValue } from "./json-value.js";
import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Immutable opaque protocol state reported for a model-service interaction.
 *
 * Service and protocol identity remain separate from the open state type. The
 * JSON value is preserved without interpretation so cursors, continuation data,
 * provider metadata, and future state forms cannot drive Core control flow.
 */
export interface ProtocolState {
  /** Model-service identity that owns the state. */
  readonly serviceId: OpenIdentifier;

  /** Protocol identity under which the state is meaningful. */
  readonly protocolId: OpenIdentifier;

  /** Standard or integration-defined classification of the state value. */
  readonly stateType: OpenIdentifier;

  /** Opaque portable state data retained exactly as reported. */
  readonly stateValue: JsonValue;
}
