// Copyright © 2026 Mcont.

import type { CodecContext } from "./codec-context.js";
import type { ErasedRuntimeValue } from "./erased-runtime-value.js";
import type { RuntimeComponent } from "./runtime-component.js";
import type { TransportBody } from "./transport-body.js";

/**
 * Replaceable behavior that encodes one typed protocol payload for transport.
 *
 * The encoder receives an erased value only after Core has validated its type
 * and schema against the component descriptor. It may observe cancellation but
 * must not inspect model requests, resolve credentials, authorize headers, send
 * network traffic, or interpret response metadata.
 */
export interface PayloadEncoder extends RuntimeComponent {
  /** Encodes one validated value into a transport body. */
  encode(value: ErasedRuntimeValue, context: CodecContext): Promise<TransportBody>;
}
