// Copyright © 2026 Mcont.

import type { CodecContext } from "./codec-context.js";
import type { ErasedRuntimeValue } from "./erased-runtime-value.js";
import type { RuntimeComponent } from "./runtime-component.js";

/**
 * Replaceable behavior that decodes bounded response bytes into a typed payload.
 *
 * Core selects the success or error decoder before transport I/O and validates
 * the actual response media type without replacing that selection. The decoder
 * therefore receives only bytes and cancellation lifecycle state; it must not
 * inspect response metadata, choose another component, parse task semantics, or
 * perform transport and authorization work.
 */
export interface PayloadDecoder extends RuntimeComponent {
  /** Decodes one bounded byte sequence into an erased protocol value. */
  decode(bytes: Uint8Array, context: CodecContext): Promise<ErasedRuntimeValue>;
}
