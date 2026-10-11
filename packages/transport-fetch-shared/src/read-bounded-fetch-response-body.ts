// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

import type { FetchResponseBodySource } from "./read-fetch-response-body.js";

/** Stable code for a response body limit that cannot be enforced. */
const INVALID_BODY_LIMIT_CODE = "invalid_body_limit";

/** Stable code for a response body that crosses the configured byte limit. */
const RESPONSE_BODY_TOO_LARGE_CODE = "response_body_too_large";

/**
 * Reads one Fetch response body without retaining bytes past a positive limit.
 *
 * Each chunk is counted before it is kept. The chunk that would cross the
 * limit is not stored, and the reader is cancelled before another chunk is
 * requested. A null body is an empty buffer. A zero-length chunk does not end
 * the read and does not count as progress. This function does not call
 * `arrayBuffer`.
 *
 * @param response Response whose body should be read incrementally.
 * @param maxByteLength Maximum retained body size, as a positive safe integer.
 * @returns A new buffer containing only the accepted bytes.
 * @throws {ModelInteractionError} When the limit is unusable or the body would exceed it.
 */
export async function readBoundedFetchResponseBody(
  response: FetchResponseBodySource,
  maxByteLength: number,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxByteLength) || maxByteLength <= 0) {
    throw createInvalidBodyLimitError();
  }

  const stream = response.body;
  if (stream === null) {
    return new Uint8Array();
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let acceptedByteLength = 0;

  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) {
        break;
      }

      const chunk = next.value;
      if (!(chunk instanceof Uint8Array)) {
        throw createInvalidResponseChunkError();
      }

      // Compare against the remaining room so a large chunk cannot overflow the sum.
      if (chunk.byteLength > maxByteLength - acceptedByteLength) {
        const error = createResponseBodyTooLargeError();
        await reader.cancel(error);
        throw error;
      }

      chunks.push(chunk);
      acceptedByteLength += chunk.byteLength;
    }
  } finally {
    if (stream.locked) {
      reader.releaseLock();
    }
  }

  const body = new Uint8Array(acceptedByteLength);
  let offset = 0;
  for (const chunk of chunks) {
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
    phase: "transport",
    code: INVALID_BODY_LIMIT_CODE,
    diagnostics: [],
  });
}

/**
 * Creates the failure for a response chunk that is not a byte view.
 *
 * @returns Transport error without the rejected chunk.
 */
function createInvalidResponseChunkError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Fetch response body chunk must be a byte view.",
    category: "protocol",
    phase: "transport",
    code: "invalid_response_body",
    diagnostics: [],
  });
}

/**
 * Creates the failure for a body that would exceed its limit.
 *
 * The code identifies the limit failure. The category stays with request
 * acceptance because the interaction cannot keep a response outside the
 * caller's configured limit, and it is not a retryable network failure.
 *
 * @returns Size error without source bytes or the accumulated length.
 */
function createResponseBodyTooLargeError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Response body exceeds its byte limit.",
    category: "invalid_request",
    phase: "transport",
    code: RESPONSE_BODY_TOO_LARGE_CODE,
    diagnostics: [],
  });
}
