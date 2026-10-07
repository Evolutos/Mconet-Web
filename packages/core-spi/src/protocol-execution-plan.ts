// Copyright © 2026 Mcont.

import type { ComponentTypeContract } from "./component-type-contract.js";
import type { DecoderSelection } from "./decoder-selection.js";
import type { EncoderSelection } from "./encoder-selection.js";
import type { PlannedComponentSelection } from "./planned-component-selection.js";
import type { TransportRequestPlan } from "./transport-request-plan.js";
import type { TransportSelection } from "./transport-selection.js";

/**
 * Immutable protocol-selected requirements for one interaction execution.
 *
 * The plan fixes request routing, independent encoder and decoder criteria,
 * transport criteria, mode-specific component roles, and the runtime type
 * boundary before network I/O. It contains requirements rather than resolved
 * components, encoded payload bytes, responses, or executable behavior.
 */
export interface ProtocolExecutionPlan {
  /** Protocol-owned request facts consumed by later encoding and transport stages. */
  readonly transportPlan: TransportRequestPlan;

  /** Criteria for selecting exactly one payload encoder. */
  readonly payloadEncoder: EncoderSelection;

  /** Criteria for selecting the successful-response decoder before I/O. */
  readonly successDecoder: DecoderSelection;

  /** Independent criteria for selecting the service-error decoder before I/O. */
  readonly errorDecoder: DecoderSelection;

  /** Transport kind and capabilities required by the protocol. */
  readonly transport: TransportSelection;

  /** Ordered requirements for components introduced by the interaction mode. */
  readonly modeComponents: readonly PlannedComponentSelection[];

  /** Runtime input and output identities expected across the protocol boundary. */
  readonly typeContract: ComponentTypeContract;

  /** Read-only top-level protocol-specific planning values. */
  readonly extensions: Readonly<Record<string, unknown>>;
}
