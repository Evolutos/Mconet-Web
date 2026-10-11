// Copyright © 2026 Mcont.

/**
 * Response surface required to read a Fetch body incrementally.
 *
 * `arrayBuffer` is part of the surface so callers can pass a platform Response,
 * but this reader never calls it. A null body is an empty payload.
 */
export interface FetchResponseBodySource {
  /** Readable body, or null when the response has no body. */
  readonly body: ReadableStream<Uint8Array> | null;

  /** Complete-body reader that this function must not call. */
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * Reads one Fetch response body through its stream reader.
 *
 * Chunks are copied into one buffer after the stream ends. A null or empty
 * body returns an empty buffer. A zero-length chunk does not end the read.
 * The reader lock is released on success and failure. This function does not
 * enforce a size limit, cancel for overflow, or call `arrayBuffer`.
 *
 * @param response Response whose body should be read incrementally.
 * @returns A new buffer containing the body bytes in chunk order.
 */
export async function readFetchResponseBody(
  response: FetchResponseBodySource,
): Promise<Uint8Array> {
  const stream = response.body;
  if (stream === null) {
    return new Uint8Array();
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalByteLength = 0;

  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) {
        break;
      }

      const chunk = next.value;
      // A zero-length chunk is real input and must not be treated as completion.
      if (!(chunk instanceof Uint8Array)) {
        throw new Error("Fetch response body chunk must be a byte array.");
      }
      chunks.push(chunk);
      totalByteLength += chunk.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalByteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
