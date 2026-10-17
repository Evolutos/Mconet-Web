// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

import type { FetchResponseBodySource } from "./read-fetch-response-body.js";

/** Stable code for a response body limit that cannot be enforced. */
const invalidBodyLimitCode = "invalid_body_limit";

/** Stable code for a response body that crosses the configured byte limit. */
const responseBodyTooLargeCode = "response_body_too_large";

/**
 * Yields one Fetch response body without retaining bytes past a positive limit.
 *
 * Each chunk is copied before it is yielded. The chunk that would cross the
 * limit is not yielded, and the reader is cancelled. `onFinish` runs once when
 * the iteration stops, including when the caller stops early. This function
 * does not call `arrayBuffer`.
 *
 * @param response Response whose body should be read incrementally.
 * @param maxByteLength Maximum retained body size, as a positive safe integer.
 * @param onFinish Callback invoked once when reading stops.
 * @returns Frames in arrival order.
 */
export async function* iterateBoundedFetchResponseBody(
  response: FetchResponseBodySource,
  maxByteLength: number,
  onFinish: () => void,
): AsyncGenerator<Uint8Array> {
  let finished = false;
  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    onFinish();
  };
  const stream = response.body;
  if (!Number.isSafeInteger(maxByteLength) || maxByteLength <= 0) {
    finish();
    throw invalidBodyLimit();
  }
  if (stream === null) {
    finish();
    return;
  }

  const reader = stream.getReader();
  let acceptedByteLength = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) {
        return;
      }
      const chunk = next.value;
      if (!(chunk instanceof Uint8Array)) {
        throw invalidChunk();
      }
      if (chunk.byteLength === 0) {
        continue;
      }
      if (chunk.byteLength > maxByteLength - acceptedByteLength) {
        const error = bodyTooLarge();
        await reader.cancel(error);
        throw error;
      }
      acceptedByteLength += chunk.byteLength;
      const copy = new Uint8Array(chunk.byteLength);
      copy.set(chunk);
      yield copy;
    }
  } finally {
    finish();
    if (stream.locked) {
      reader.releaseLock();
    }
  }
}

/** @returns Configuration error without the rejected limit. */
function invalidBodyLimit(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Response body byte limit must be a positive safe integer.",
    category: "invalid_component_configuration",
    phase: "transport",
    code: invalidBodyLimitCode,
    diagnostics: [],
  });
}

/** @returns Transport error without the rejected chunk. */
function invalidChunk(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Fetch response body chunk must be a byte view.",
    category: "protocol",
    phase: "transport",
    code: "invalid_response_body",
    diagnostics: [],
  });
}

/** @returns Size error without the accumulated length. */
function bodyTooLarge(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Response body exceeds its byte limit.",
    category: "invalid_request",
    phase: "transport",
    code: responseBodyTooLargeCode,
    diagnostics: [],
  });
}
