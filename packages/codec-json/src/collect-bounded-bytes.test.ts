// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { collectBoundedBytes } from "./collect-bounded-bytes.js";

/** Positive limit used by the representative collection cases. */
const maximumBodyBytes = 4;

it("copies chunks that fit the limit in source order", () => {
  const first = new Uint8Array([1, 2]);
  const second = new Uint8Array([3, 4]);
  const body = collectBoundedBytes([first, second], maximumBodyBytes);

  // The result is a new buffer, so later changes to the inputs stay local.
  first[0] = 0;
  expect(Array.from(body)).toEqual([1, 2, 3, 4]);
  expect(body).not.toBe(first);
});

it("accepts a body whose length is exactly the limit", () => {
  const body = collectBoundedBytes([new Uint8Array([1, 2, 3, 4])], maximumBodyBytes);

  expect(Array.from(body)).toEqual([1, 2, 3, 4]);
});

it("ignores an empty chunk without treating it as the end of the body", () => {
  const body = collectBoundedBytes(
    [new Uint8Array([1]), new Uint8Array(), new Uint8Array([2])],
    maximumBodyBytes,
  );

  // A zero-length view is present input and must not drop the following bytes.
  expect(Array.from(body)).toEqual([1, 2]);
});

it("accepts an empty chunk sequence as an empty buffer", () => {
  const body = collectBoundedBytes([], maximumBodyBytes);

  expect(body).toBeInstanceOf(Uint8Array);
  expect(body.byteLength).toBe(0);
});

it("copies only the bytes visible through a partial view", () => {
  const buffer = new Uint8Array([9, 1, 2, 9]);
  const view = buffer.subarray(1, 3);

  // The shared backing bytes outside the view are not part of the body.
  expect(Array.from(collectBoundedBytes([view], maximumBodyBytes))).toEqual([1, 2]);
});

it("fails on the first oversized chunk and does not read any later chunk", () => {
  let reads = 0;
  const chunks = {
    *[Symbol.iterator](): Iterator<Uint8Array> {
      reads += 1;
      yield new Uint8Array([1, 2]);
      reads += 1;
      yield new Uint8Array([3, 4, 5]);
      reads += 1;
      throw new Error("collector read past the failing chunk");
    },
  };

  expect(() => collectBoundedBytes(chunks, maximumBodyBytes)).toThrowError(
    expect.objectContaining({ code: "response_body_too_large" }),
  );
  expect(reads).toBe(2);
});

it("does not retain source bytes in an oversized-body error", () => {
  const secretByte = 7;
  let caught: unknown;

  try {
    collectBoundedBytes([new Uint8Array([secretByte, secretByte])], 1);
  } catch (error) {
    caught = error;
  }

  expect(caught).toMatchObject({
    category: "deserialization",
    phase: "decoding",
    code: "response_body_too_large",
  });
  expect(JSON.stringify(caught)).not.toContain(String(secretByte));
});

it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
  "rejects the unusable body limit %s before reading chunks",
  (maxByteLength) => {
    let reads = 0;
    const chunks = {
      *[Symbol.iterator](): Iterator<Uint8Array> {
        reads += 1;
        yield new Uint8Array([1]);
      },
    };

    expect(() => collectBoundedBytes(chunks, maxByteLength)).toThrowError(
      expect.objectContaining({ code: "invalid_component_configuration" }),
    );
    expect(reads).toBe(0);
  },
);

it("rejects a chunk that is not a byte view", () => {
  const chunks = {
    *[Symbol.iterator](): Iterator<Uint8Array> {
      // The runtime value intentionally violates the byte-view contract.
      yield { byteLength: 1 } as unknown as Uint8Array;
    },
  };

  expect(() => collectBoundedBytes(chunks, maximumBodyBytes)).toThrowError(
    expect.objectContaining({ code: "deserialization" }),
  );
});
