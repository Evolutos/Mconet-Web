// Copyright © 2026 Mcont.

import type { PayloadDecoder, TransportOutcome } from "@evolutos/mconet-core-spi";

/**
 * Schedules the success-outcome decoder branch.
 *
 * A success outcome returns the decoder that was fixed before I/O. Any other
 * outcome returns `undefined` and does not consult the error decoder. This
 * branch does not decode bytes and does not select a new component.
 *
 * @param input Transport outcome and the pre-fixed success decoder.
 * @returns The success decoder, or `undefined` when the outcome is not success.
 */
export function scheduleSuccessDecoderBranch(input: {
  readonly outcome: TransportOutcome;
  readonly successPayloadDecoder: PayloadDecoder;
}): PayloadDecoder | undefined {
  if (input.outcome !== "success") {
    // Service and transport failures belong to the error branch.
    return undefined;
  }
  return input.successPayloadDecoder;
}
