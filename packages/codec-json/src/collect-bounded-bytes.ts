// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

/** Stable code for a response body that crosses the configured byte limit. */
const RESPONSE_BODY_TOO_LARGE_CODE = "response_body_too_large";

/** Stable code for a body limit that is not a positive safe integer. */
const INVALID_BODY_LIMIT_CODE = "invalid_component_configuration";

/**
 * Copies iterable byte chunks into one buffer that cannot exceed a positive limit.
 *
 * The walk stops at the first chunk that would make the accepted total larger
 * than `maxByteLength`. That chunk is not copied, later chunks are not read, and
 * the error does not retain any source bytes. An invalid limit fails before the
 * first read. This function does not decode text, parse JSON, or inspect media
 * types.
 *
 * @param chunks Ordered byte views. Each view is measured by its own byte length.
 * @param maxByteLength Maximum accepted total as a positive safe integer.
 * @returns A new buffer containing every accepted byte in source order.
 * @throws {ModelInteractionError} When the limit is unusable or the body would exceed it.
 */
export function collectBoundedBytes(
  chunks: Iterable<Uint8Array>,
  maxByteLength: number,
): Uint8Array {
  // Reject the limit before touching the source so a bad configuration cannot
  // be reported as an oversized body or consume caller data.
  if (!Number.isSafeInteger(maxByteLength) || maxByteLength <= 0) {
    throw createInvalidBodyLimitError();
  }

  const acceptedChunks: Uint8Array[] = [];
  let acceptedByteLength = 0;

  for (const chunk of chunks) {
    // A non-byte chunk cannot be measured safely. Fail without guessing a length.
    if (!(chunk instanceof Uint8Array)) {
      throw createInvalidBodyChunkError();
    }

    // Compare against the remaining room so a huge chunk cannot overflow the sum.
    if (chunk.byteLength > maxByteLength - acceptedByteLength) {
      throw createResponseBodyTooLargeError();
    }

    acceptedChunks.push(chunk);
    acceptedByteLength += chunk.byteLength;
  }

  // Copy only after every chunk fits. The result does not share the caller's buffers.
  const body = new Uint8Array(acceptedByteLength);
  let offset = 0;
  for (const chunk of acceptedChunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/**
 * Creates the failure for a body limit that cannot be enforced.
 *
 * @returns Configuration error without the rejected limit value.
 */
function createInvalidBodyLimitError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Response body byte limit must be a positive safe integer.",
    category: "invalid_component_configuration",
    phase: "decoding",
    code: INVALID_BODY_LIMIT_CODE,
    diagnostics: [],
  });
}

/**
 * Creates the failure for a chunk that is not a byte view.
 *
 * @returns Decoding error without the rejected chunk.
 */
function createInvalidBodyChunkError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Response body chunk must be a byte view.",
    category: "deserialization",
    phase: "decoding",
    code: "deserialization",
    diagnostics: [],
  });
}

/**
 * Creates the failure for a body that would exceed its limit.
 *
 * @returns Size error without source bytes or the accumulated length.
 */
function createResponseBodyTooLargeError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Response body exceeds its byte limit.",
    category: "deserialization",
    phase: "decoding",
    code: RESPONSE_BODY_TOO_LARGE_CODE,
    diagnostics: [],
  });
}
