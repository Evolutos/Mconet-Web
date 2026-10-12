// Copyright © 2026 Mcont.

import type { PayloadDecoder, TransportOutcome } from "@evolutos/mconet-core-spi";

/**
 * Schedules the service-error decoder branch.
 *
 * A service-error outcome returns the decoder that was fixed before I/O. A
 * success or transport-error outcome returns `undefined` and does not consult
 * the success decoder. This branch does not decode bytes and does not select a
 * new component.
 *
 * @param input Transport outcome and the pre-fixed error decoder.
 * @returns The error decoder, or `undefined` when the outcome is not a service error.
 */
export function scheduleErrorDecoderBranch(input: {
  readonly outcome: TransportOutcome;
  readonly errorPayloadDecoder: PayloadDecoder;
}): PayloadDecoder | undefined {
  if (input.outcome !== "service_error") {
    // Transport failures are not service payloads, and success uses the other branch.
    return undefined;
  }
  return input.errorPayloadDecoder;
}
