// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import { expect, it } from "vitest";

import type { FetchResponseBodySource } from "./read-fetch-response-body.js";
import { readBoundedFetchResponseBody } from "./read-bounded-fetch-response-body.js";

/** Positive limit used by the representative read cases. */
const maximumBodyBytes = 4;

/** Text that must not be copied into a limit failure. */
const secretBodyText = "bounded-body-secret";

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

it("reads a body that fits the limit, including a zero-length chunk", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1]));
      controller.enqueue(new Uint8Array());
      controller.enqueue(new Uint8Array([2, 3, 4]));
      controller.close();
    },
  });

  const body = await readBoundedFetchResponseBody(source(stream), maximumBodyBytes);

  expect(Array.from(body)).toEqual([1, 2, 3, 4]);
  expect(stream.locked).toBe(false);
});

it("returns an empty buffer for an absent body", async () => {
  const body = await readBoundedFetchResponseBody(source(null), maximumBodyBytes);

  expect(body.byteLength).toBe(0);
});

it("cancels before reading another chunk when the next chunk would exceed the limit", async () => {
  let pulls = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      if (pulls === 1) {
        controller.enqueue(new Uint8Array([1, 2]));
        return;
      }
      if (pulls === 2) {
        controller.enqueue(new TextEncoder().encode(secretBodyText));
        return;
      }
      controller.enqueue(new Uint8Array([9]));
    },
  });

  let caught: unknown;
  try {
    await readBoundedFetchResponseBody(source(stream), maximumBodyBytes);
  } catch (error) {
    caught = error;
  }

  expect(pulls).toBe(2);
  expect(stream.locked).toBe(false);
  expect(caught).toBeInstanceOf(ModelInteractionError);
  if (!(caught instanceof ModelInteractionError)) {
    return;
  }
  expect(caught).toMatchObject({
    category: "invalid_request",
    phase: "transport",
    code: "response_body_too_large",
    message: "Response body exceeds its byte limit.",
  });
  expect(String(caught)).not.toContain(secretBodyText);
  expect(JSON.stringify(caught)).not.toContain(secretBodyText);
});

it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
  "rejects the unusable limit %s before reading",
  async (limit) => {
    const body = {
      getReader(): ReadableStreamDefaultReader<Uint8Array> {
        throw new Error("reader requested");
      },
    } as unknown as ReadableStream<Uint8Array>;

    await expect(readBoundedFetchResponseBody(source(body), limit)).rejects.toMatchObject({
      category: "invalid_component_configuration",
      phase: "transport",
      code: "invalid_body_limit",
      message: "Response body byte limit must be a positive safe integer.",
    });
  },
);
