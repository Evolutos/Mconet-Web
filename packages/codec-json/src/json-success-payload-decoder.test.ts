// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { JsonSuccessPayloadDecoder } from "./json-success-payload-decoder.js";

/** Limit large enough for the small JSON fixtures in this file. */
const maximumDecodedBodyBytes = 64;

/** UTF-8 bytes for one JSON text fixture. */
function jsonBytes(jsonText: string): Uint8Array {
  return new TextEncoder().encode(jsonText);
}

it.each([
  { label: "object", jsonText: '{"b":1,"a":false}', value: { b: 1, a: false } },
  { label: "null", jsonText: "null", value: null },
  { label: "empty object", jsonText: "{}", value: {} },
  { label: "empty array", jsonText: "[]", value: [] },
  { label: "empty string", jsonText: '""', value: "" },
  { label: "unicode string", jsonText: '"A𐀀😀"', value: "A𐀀😀" },
  { label: "zero", jsonText: "0", value: 0 },
  { label: "false", jsonText: "false", value: false },
])("decodes a JSON $label", async ({ jsonText, value }) => {
  const decoder = new JsonSuccessPayloadDecoder(maximumDecodedBodyBytes);
  const decoded = await decoder.decode(jsonBytes(jsonText), {
    signal: new AbortController().signal,
  });

  // The decoded port carries the JSON value only. Protocol schema identity is
  // not inferred from the body.
  expect(decoded).toEqual({ typeId: "json.value", value });
  expect(decoded.schemaId).toBeUndefined();
});

it("accepts a body whose UTF-8 length equals the limit", async () => {
  const decoder = new JsonSuccessPayloadDecoder(jsonBytes("null").byteLength);
  const decoded = await decoder.decode(jsonBytes("null"), {
    signal: new AbortController().signal,
  });

  expect(decoded.value).toBeNull();
});

it("does not mutate the supplied bytes", async () => {
  const decoder = new JsonSuccessPayloadDecoder(maximumDecodedBodyBytes);
  const bytes = jsonBytes('{"ok":true}');
  const snapshot = bytes.slice();

  await decoder.decode(bytes, { signal: new AbortController().signal });

  expect(Array.from(bytes)).toEqual(Array.from(snapshot));
});

it.each([
  { label: "empty body", bytes: new Uint8Array() },
  { label: "invalid JSON", bytes: jsonBytes("{") },
  { label: "invalid UTF-8", bytes: new Uint8Array([0xff]) },
  { label: "negative zero", bytes: jsonBytes("-0") },
  { label: "non-finite number", bytes: jsonBytes("1e309") },
])("rejects $label without retaining the body", async ({ label, bytes }) => {
  const decoder = new JsonSuccessPayloadDecoder(maximumDecodedBodyBytes);
  let caught: unknown;

  try {
    await decoder.decode(bytes, { signal: new AbortController().signal });
  } catch (error) {
    caught = error;
  }

  expect(caught, label).toMatchObject({
    category: "deserialization",
    phase: "decoding",
    code: "deserialization",
    diagnostics: [],
  });
  expect(caught).toBeInstanceOf(Error);
  if (caught instanceof Error) {
    // The technical message must not quote the rejected body. The serialized
    // error object itself contains braces, so the check stays on the message.
    expect(caught.message).not.toContain("1e309");
    expect(caught.message).not.toContain("{");
    expect(caught.cause).toBeUndefined();
  }
});

it("reports a body over the limit without wrapping or copying it", async () => {
  const decoder = new JsonSuccessPayloadDecoder(1);
  const bytes = jsonBytes("null");
  let caught: unknown;

  try {
    await decoder.decode(bytes, { signal: new AbortController().signal });
  } catch (error) {
    caught = error;
  }

  expect(caught).toMatchObject({ code: "response_body_too_large" });
  expect(JSON.stringify(caught)).not.toContain("null");
});

it("reports cancellation before parsing an invalid body", async () => {
  const decoder = new JsonSuccessPayloadDecoder(maximumDecodedBodyBytes);
  const controller = new AbortController();
  controller.abort();

  await expect(decoder.decode(jsonBytes("{"), { signal: controller.signal })).rejects.toMatchObject(
    {
      category: "cancelled",
      phase: "decoding",
      code: "cancelled",
    },
  );
});

it.each([0, -1, Number.NaN])(
  "rejects the unusable body limit %s at construction",
  (maxBodyBytes) => {
    expect(() => new JsonSuccessPayloadDecoder(maxBodyBytes)).toThrowError(
      expect.objectContaining({ code: "invalid_component_configuration" }),
    );
  },
);
