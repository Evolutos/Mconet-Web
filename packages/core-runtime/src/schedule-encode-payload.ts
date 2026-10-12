// Copyright © 2026 Mcont.

import type { ProcessingResult } from "@evolutos/mconet-core-domain";
import type {
  CodecContext,
  ErasedRuntimeValue,
  PayloadEncoder,
  TransportBody,
} from "@evolutos/mconet-core-spi";

/** Stable code when encoding fails before authorization. */
const encodingFailedCode = "encoding_failed";

/**
 * Schedules payload encoding and stops before authorization.
 *
 * The selected encoder is called once. A resolved body is returned as the
 * value. A rejection becomes one encoding diagnostic and no value, so a later
 * authorization stage has nothing to apply. The encoder's message is not
 * copied, because it may contain payload text. This stage does not authorize
 * or send.
 *
 * @param input Encoder, erased payload, and the codec cancellation context.
 * @returns The encoded body, or diagnostics and no value.
 */
export async function scheduleEncodePayload(input: {
  readonly encoder: PayloadEncoder;
  readonly payload: ErasedRuntimeValue;
  readonly context: CodecContext;
}): Promise<ProcessingResult<TransportBody>> {
  try {
    const body = await input.encoder.encode(input.payload, input.context);
    return { diagnostics: [], value: body };
  } catch {
    // Authorization is a later stage. A failed body must not be handed to it,
    // and the thrown text must not become a diagnostic.
    return {
      diagnostics: [
        {
          code: encodingFailedCode,
          severity: "error",
          phase: "encoding",
          message: "The protocol payload could not be encoded.",
        },
      ],
    };
  }
}
