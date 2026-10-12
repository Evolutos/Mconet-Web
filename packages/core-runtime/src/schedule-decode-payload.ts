// Copyright © 2026 Mcont.

import type { ProcessingResult } from "@evolutos/mconet-core-domain";
import type { CodecContext, ErasedRuntimeValue, PayloadDecoder } from "@evolutos/mconet-core-spi";

/** Stable code when decoding fails. */
const decodingFailedCode = "decoding_failed";

/**
 * Schedules one payload decode.
 *
 * The decoder selected before I/O is called once with the response bytes and
 * the codec signal. A rejection becomes a decoding diagnostic and no value.
 * The thrown text is not copied. This stage does not parse a task result and
 * does not choose a different decoder.
 *
 * @param input Selected decoder, response bytes, and the codec cancellation context.
 * @returns The decoded value, or diagnostics and no value.
 */
export async function scheduleDecodePayload(input: {
  readonly decoder: PayloadDecoder;
  readonly bytes: Uint8Array;
  readonly context: CodecContext;
}): Promise<ProcessingResult<ErasedRuntimeValue>> {
  try {
    const value = await input.decoder.decode(input.bytes, input.context);
    return { diagnostics: [], value };
  } catch {
    return {
      diagnostics: [
        {
          code: decodingFailedCode,
          severity: "error",
          phase: "decoding",
          message: "The response payload could not be decoded.",
        },
      ],
    };
  }
}
