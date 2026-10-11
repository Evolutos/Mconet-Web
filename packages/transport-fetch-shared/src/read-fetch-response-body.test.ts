// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { readFetchResponseBody, type FetchResponseBodySource } from "./read-fetch-response-body.js";

/**
 * Builds a body source whose complete-buffer method fails if it is called.
 *
 * @param body Stream to expose, or null for an absent body.
 * @returns Source that only the incremental reader can consume safely.
 */
function source(body: ReadableStream<Uint8Array> | null): FetchResponseBodySource {
  return {
    body,
    arrayBuffer(): Promise<ArrayBuffer> {
      throw new Error("arrayBuffer called");
    },
  };
}

it("reads chunks in order without calling arrayBuffer", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2]));
      controller.enqueue(new Uint8Array());
      controller.enqueue(new Uint8Array([3]));
      controller.close();
    },
  });

  const body = await readFetchResponseBody(source(stream));

  expect(Array.from(body)).toEqual([1, 2, 3]);
  expect(stream.locked).toBe(false);
});

it("returns an empty buffer when the response body is absent", async () => {
  const body = await readFetchResponseBody(source(null));

  expect(body).toBeInstanceOf(Uint8Array);
  expect(body.byteLength).toBe(0);
});

it("returns an empty buffer when the stream closes without chunks", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });

  const body = await readFetchResponseBody(source(stream));

  expect(body.byteLength).toBe(0);
  expect(stream.locked).toBe(false);
});

it("releases the reader lock when a chunk read fails", async () => {
  const failure = new Error("chunk-read-failed");
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.error(failure);
    },
  });

  await expect(readFetchResponseBody(source(stream))).rejects.toBe(failure);
  expect(stream.locked).toBe(false);
});
