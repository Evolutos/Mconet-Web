// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { JsonValue, OpenIdentifier } from "@evolutos/mconet-core-domain";
import type { ErasedRuntimeValue, ProtocolRequestPlan } from "@evolutos/mconet-core-spi";

import type { JsonPayload } from "./json-payload.js";

it("narrows only the erased value representation to JsonValue", () => {
  // Exact structural equality freezes the adapter-facing envelope without
  // adding media types, validators, codecs, descriptors, or transport facts.
  expectTypeOf<JsonPayload>().toEqualTypeOf<{
    readonly typeId: OpenIdentifier;
    readonly schemaId?: string;
    readonly value: JsonValue;
  }>();
  expectTypeOf<JsonPayload>().toMatchTypeOf<ErasedRuntimeValue>();
  expectTypeOf<ErasedRuntimeValue>().not.toMatchTypeOf<JsonPayload>();
});

it("accepts every JSON value category while preserving adapter port identities", () => {
  const payloads = [
    { typeId: "json.null", value: null },
    { typeId: "json.boolean", value: true },
    { typeId: "json.number", value: 42 },
    { typeId: "json.string", value: "hello" },
    { typeId: "json.array", value: ["hello", 42, false, null] },
    {
      typeId: "json.object",
      schemaId: "schema://json.contract/object/1",
      value: { nested: { enabled: true }, items: [1, 2, 3] },
    },
  ] as const satisfies readonly JsonPayload[];

  // A JSON payload remains assignable to the exact erased request port emitted
  // by TaskProtocolAdapter without casting or reconstructing the envelope.
  const adapterPayloads: readonly ProtocolRequestPlan["payload"][] = payloads;
  expect(adapterPayloads).toBe(payloads);
  expect(payloads.map(({ typeId }) => typeId)).toEqual([
    "json.null",
    "json.boolean",
    "json.number",
    "json.string",
    "json.array",
    "json.object",
  ]);
});

it("rejects non-JSON erased representations at compile time", () => {
  // Each excluded value is valid unknown data on ErasedRuntimeValue but cannot
  // cross the JSON codec boundary before runtime validation narrows it.
  expectTypeOf<{
    readonly typeId: "json.bigint";
    readonly value: bigint;
  }>().not.toMatchTypeOf<JsonPayload>();
  expectTypeOf<{
    readonly typeId: "json.undefined";
    readonly value: undefined;
  }>().not.toMatchTypeOf<JsonPayload>();
  expectTypeOf<{
    readonly typeId: "json.bytes";
    readonly value: Uint8Array;
  }>().not.toMatchTypeOf<JsonPayload>();
  expectTypeOf<{
    readonly typeId: "json.date";
    readonly value: Date;
  }>().not.toMatchTypeOf<JsonPayload>();
  expectTypeOf<{
    readonly typeId: "json.function";
    readonly value: () => void;
  }>().not.toMatchTypeOf<JsonPayload>();
});

it("prevents replacement of envelope and JSON value references", () => {
  const proveReadonly = (payload: JsonPayload, value: JsonValue): void => {
    // This helper is compile-only and proves all port facts remain immutable
    // without mutating a runtime fixture used by another test.
    // @ts-expect-error Type identity cannot be replaced.
    payload.typeId = "json.replacement";
    // @ts-expect-error Optional Schema identity cannot be replaced.
    payload.schemaId = "schema://replacement";
    // @ts-expect-error The narrowed JSON value reference cannot be replaced.
    payload.value = value;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
