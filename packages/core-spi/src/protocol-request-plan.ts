// Copyright © 2026 Mcont.

import type { ErasedRuntimeValue } from "./erased-runtime-value.js";
import type { ProtocolExecutionPlan } from "./protocol-execution-plan.js";

/**
 * Immutable protocol request payload paired with its prevalidated execution plan.
 *
 * A protocol adapter produces this value after mapping a model request and any
 * resolved artifacts. The Runtime retains the exact execution requirements that
 * governed mapping while a later encoder converts the erased payload to bytes.
 * This carrier does not encode, authorize, send, or parse network data.
 */
export interface ProtocolRequestPlan {
  /** Typed protocol-native request value awaiting the selected payload encoder. */
  readonly payload: ErasedRuntimeValue;

  /** Execution requirements prepared before components and capabilities were validated. */
  readonly executionPlan: ProtocolExecutionPlan;
}
