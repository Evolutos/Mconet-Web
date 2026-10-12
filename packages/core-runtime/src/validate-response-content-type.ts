// Copyright © 2026 Mcont.

import type { MediaType, ProcessingResult } from "@evolutos/mconet-core-domain";
import type { PayloadDecoder } from "@evolutos/mconet-core-spi";

/** Stable code when the response content type is outside the fixed decoder. */
const contentTypeMismatchCode = "content_type_mismatch";

/**
 * Checks a response content type against the decoder fixed before I/O.
 *
 * A decoder that declares input media types accepts a response whose type and
 * subtype match one of them. Parameters such as charset do not select a
 * different decoder and do not by themselves fail the check. A decoder that
 * omits the collection accepts the response as it is, including a missing
 * content type. This guard never substitutes another decoder.
 *
 * @param input Response media type and the already selected decoder.
 * @returns The same decoder, or diagnostics and no value.
 */
export function validateResponseContentType(input: {
  readonly mediaType?: MediaType;
  readonly decoder: PayloadDecoder;
}): ProcessingResult<PayloadDecoder> {
  const accepted = input.decoder.descriptor.typeContract?.inputMediaTypes;
  if (accepted === undefined) {
    // No declared wire constraint means this decoder stays selected.
    return { diagnostics: [], value: input.decoder };
  }

  const mediaType = input.mediaType;
  if (
    mediaType !== undefined &&
    accepted.some((candidate) => sameMediaFamily(mediaType, candidate))
  ) {
    return { diagnostics: [], value: input.decoder };
  }

  return {
    diagnostics: [
      {
        code: contentTypeMismatchCode,
        severity: "error",
        phase: "decoding",
        message: "The response content type is not accepted by the selected decoder.",
      },
    ],
  };
}

/**
 * Compares the type and subtype of two media types.
 *
 * @param left Response media type.
 * @param right Media type declared by the selected decoder.
 * @returns Whether both name the same type and subtype.
 */
function sameMediaFamily(left: MediaType, right: MediaType): boolean {
  return left.type === right.type && left.subtype === right.subtype;
}
