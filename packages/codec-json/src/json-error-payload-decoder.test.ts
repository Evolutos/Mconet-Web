// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { JsonErrorPayloadDecoder } from "./json-error-payload-decoder.js";
import { JsonSuccessPayloadDecoder } from "./json-success-payload-decoder.js";

/** Limit large enough for the small error fixtures in this file. */
const maximumDecodedBodyBytes = 64;

/** UTF-8 bytes for one JSON text fixture. */
function jsonBytes(jsonText: string): Uint8Array {
  return new TextEncoder().encode(jsonText);
}

it("is a different component from the success decoder", () => {
  const errorDecoder = new JsonErrorPayloadDecoder(maximumDecodedBodyBytes);
  const successDecoder = new JsonSuccessPayloadDecoder(maximumDecodedBodyBytes);

  // Outcome selection depends on distinct instances and distinct descriptors.
  expect(errorDecoder).not.toBe(successDecoder);
  expect(errorDecoder.descriptor).not.toBe(successDecoder.descriptor);
  expect(errorDecoder.descriptor).toMatchObject({
    name: "json-error-payload-decoder",
    version: "1.0.0",
    source: "builtin",
  });
  expect(errorDecoder.descriptor.typeContract).toBeUndefined();
  expect(errorDecoder.descriptor.capabilities.size).toBe(0);
});

it("decodes a JSON error object without inventing a protocol schema", async () => {
  const decoder = new JsonErrorPayloadDecoder(maximumDecodedBodyBytes);
  const decoded = await decoder.decode(jsonBytes('{"code":"rate_limit","message":"slow down"}'), {
    signal: new AbortController().signal,
  });

  expect(decoded).toEqual({
    typeId: "json.value",
    value: { code: "rate_limit", message: "slow down" },
  });
  expect(decoded.schemaId).toBeUndefined();
});

it("omits an invalid error body from the decoding failure", async () => {
  const decoder = new JsonErrorPayloadDecoder(maximumDecodedBodyBytes);
  const body = '{"message":"provider failed"';
  let caught: unknown;

  try {
    await decoder.decode(jsonBytes(body), { signal: new AbortController().signal });
  } catch (error) {
    caught = error;
  }

  expect(caught).toMatchObject({
    category: "deserialization",
    code: "deserialization",
    diagnostics: [],
  });
  expect(caught).toBeInstanceOf(Error);
  if (caught instanceof Error) {
    // The incomplete provider message must not be copied into the SDK error.
    expect(caught.message).not.toContain("provider failed");
    expect(caught.cause).toBeUndefined();
  }
});

it("rejects an oversized error body without copying its text", async () => {
  const decoder = new JsonErrorPayloadDecoder(1);
  let caught: unknown;

  try {
    await decoder.decode(jsonBytes('{"detail":"too large"}'), {
      signal: new AbortController().signal,
    });
  } catch (error) {
    caught = error;
  }

  expect(caught).toMatchObject({ code: "response_body_too_large" });
  expect(caught).toBeInstanceOf(Error);
  if (caught instanceof Error) {
    expect(caught.message).not.toContain("too large");
    expect(caught.cause).toBeUndefined();
  }
});

it("reports cancellation before reading an invalid error body", async () => {
  const decoder = new JsonErrorPayloadDecoder(maximumDecodedBodyBytes);
  const controller = new AbortController();
  controller.abort();

  await expect(decoder.decode(jsonBytes("}"), { signal: controller.signal })).rejects.toMatchObject(
    {
      category: "cancelled",
      code: "cancelled",
    },
  );
});
