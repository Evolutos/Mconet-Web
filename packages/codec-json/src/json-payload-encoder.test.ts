// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type { ErasedRuntimeValue } from "@evolutos/mconet-core-spi";

import { JsonPayloadEncoder } from "./json-payload-encoder.js";

/** Decodes encoder bytes without using the codec's own UTF-8 helper. */
function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

it("omits an empty schema identity from the encoded body", async () => {
  const encoder = new JsonPayloadEncoder();
  const payload: ErasedRuntimeValue = {
    typeId: "json.object",
    schemaId: "",
    value: { ok: true },
  };

  const body = await encoder.encode(payload, { signal: new AbortController().signal });

  // An empty schema identity is present on the envelope and distinct from an
  // omitted one, but neither identity is part of the JSON body.
  expect(decodeUtf8(body.bytes)).toBe('{"ok":true}');
});

it("encodes only the JSON value and keeps source member order", async () => {
  const encoder = new JsonPayloadEncoder();
  const payload: ErasedRuntimeValue = {
    typeId: "task.input.conversation",
    schemaId: "schema://example/request",
    value: { b: 1, a: { enabled: false, items: ["hello", null] } },
  };

  const body = await encoder.encode(payload, { signal: new AbortController().signal });

  // Port metadata stays out of the body even when the type identity uses task
  // vocabulary and the schema identity looks like a route.
  expect(body.kind).toBe("bytes");
  expect(decodeUtf8(body.bytes)).toBe('{"b":1,"a":{"enabled":false,"items":["hello",null]}}');
  expect(decodeUtf8(body.bytes)).not.toContain("task.input.conversation");
  expect(decodeUtf8(body.bytes)).not.toContain("schema://example/request");
});

it("encodes every JSON value category without adding an envelope", async () => {
  const encoder = new JsonPayloadEncoder();
  const signal = new AbortController().signal;
  const cases = [
    { typeId: "json.null", value: null, expected: "null" },
    { typeId: "json.boolean", value: false, expected: "false" },
    { typeId: "json.number", value: 0, expected: "0" },
    { typeId: "json.string", value: "", expected: '""' },
    { typeId: "json.string", value: "A𐀀😀", expected: '"A𐀀😀"' },
    { typeId: "json.array", value: [], expected: "[]" },
    { typeId: "json.object", value: {}, expected: "{}" },
  ] as const;

  for (const testCase of cases) {
    const body = await encoder.encode(testCase, { signal });
    expect(decodeUtf8(body.bytes)).toBe(testCase.expected);
  }
});

it("does not mutate the payload or its context", async () => {
  const encoder = new JsonPayloadEncoder();
  const payload: ErasedRuntimeValue = {
    typeId: "json.object",
    value: { count: 0, values: ["ok"] },
  };
  const context = { signal: new AbortController().signal };
  const payloadSnapshot = structuredClone(payload);

  await encoder.encode(payload, context);

  expect(payload).toEqual(payloadSnapshot);
  expect(context.signal.aborted).toBe(false);
});

it("returns a new byte array for each encoding", async () => {
  const encoder = new JsonPayloadEncoder();
  const payload: ErasedRuntimeValue = { typeId: "json.string", value: "A" };
  const signal = new AbortController().signal;
  const first = await encoder.encode(payload, { signal });
  const second = await encoder.encode(payload, { signal });

  first.bytes[0] = 0;
  expect(Array.from(second.bytes)).not.toEqual([0]);
  expect(first.bytes).not.toBe(second.bytes);
});

it.each([
  { label: "non-finite number", value: Number.NaN },
  { label: "infinite number", value: Number.POSITIVE_INFINITY },
  { label: "negative zero", value: -0 },
  { label: "undefined object member", value: { present: undefined } },
  { label: "undefined array element", value: [undefined] },
  { label: "sparse array", value: Array(1) },
  { label: "function", value: () => undefined },
  { label: "bigint", value: 1n },
  { label: "date", value: new Date(0) },
  { label: "byte array", value: new Uint8Array() },
])("rejects a $label before producing JSON text", async ({ value }) => {
  const encoder = new JsonPayloadEncoder();
  const payload = { typeId: "json.value", value };

  await expect(
    encoder.encode(payload, { signal: new AbortController().signal }),
  ).rejects.toMatchObject({
    name: "ModelInteractionError",
    category: "serialization",
    phase: "encoding",
    code: "serialization",
  });
});

it("rejects a cyclic object without embedding it in the error", async () => {
  const encoder = new JsonPayloadEncoder();
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;

  const error = await encoder
    .encode({ typeId: "json.object", value: cyclic }, { signal: new AbortController().signal })
    .catch((caught: unknown) => caught);

  expect(error).toMatchObject({ code: "serialization" });
  expect(JSON.stringify(error)).not.toContain("self");
});

it.each([
  { label: "blank type identity", payload: { typeId: " ", value: null } },
  { label: "null schema identity", payload: { typeId: "json.null", schemaId: null, value: null } },
  { label: "numeric schema identity", payload: { typeId: "json.null", schemaId: 1, value: null } },
])("rejects an envelope with a $label", async ({ payload }) => {
  const encoder = new JsonPayloadEncoder();

  await expect(
    encoder.encode(payload as ErasedRuntimeValue, { signal: new AbortController().signal }),
  ).rejects.toMatchObject({ code: "serialization" });
});

it("reports cancellation before serialization when the signal is already aborted", async () => {
  const encoder = new JsonPayloadEncoder();
  const controller = new AbortController();
  controller.abort();

  await expect(
    encoder.encode({ typeId: "json.number", value: Number.NaN }, { signal: controller.signal }),
  ).rejects.toMatchObject({
    category: "cancelled",
    phase: "encoding",
    code: "cancelled",
  });
});
