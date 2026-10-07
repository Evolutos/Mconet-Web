// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

import type { ErasedRuntimeValue } from "./erased-runtime-value.js";

it("defines explicit identities around an unknown immutable value", () => {
  // Exact equality prevents any, generic payload assumptions, components,
  // validators, capabilities, transport data, or selection state from entering.
  expectTypeOf<ErasedRuntimeValue>().toEqualTypeOf<{
    readonly typeId: OpenIdentifier;
    readonly schemaId?: string;
    readonly value: unknown;
  }>();
  expectTypeOf<ErasedRuntimeValue["value"]>().toEqualTypeOf<unknown>();
});

it("retains an arbitrary payload and optional Schema identity without inspection", () => {
  const payload = { choices: [{ text: "retained" }] };
  const withSchema: ErasedRuntimeValue = {
    typeId: "vendor.response.payload",
    schemaId: "https://schemas.example.test/response.json",
    value: payload,
  };
  const withoutSchema: ErasedRuntimeValue = {
    typeId: "vendor.binary.payload",
    value: new Uint8Array([0, 127, 255]),
  };

  // The envelope stores facts only. It does not clone, parse, validate, coerce,
  // serialize, or infer a Schema identity from either payload value.
  expect(withSchema.value).toBe(payload);
  expect(withSchema.schemaId).toBe("https://schemas.example.test/response.json");
  expect(Object.hasOwn(withoutSchema, "schemaId")).toBe(false);
  expect(withoutSchema.value).toEqual(new Uint8Array([0, 127, 255]));
});

it("requires narrowing before payload members can be consumed", () => {
  const consumeWithoutNarrowing = (erased: ErasedRuntimeValue): void => {
    // The helper is compiled but never invoked. This expected error proves that
    // unknown does not silently behave like any at a component boundary.
    // @ts-expect-error An erased payload has no accessible members before narrowing.
    void erased.value.result;
  };

  // Keeping the helper in the program makes strict TypeScript retain the
  // unknown-value protection without performing a runtime access.
  expectTypeOf(consumeWithoutNarrowing).toBeFunction();
});

it("prevents replacement of identities or the erased payload", () => {
  const proveReadonly = (erased: ErasedRuntimeValue): void => {
    // These assignments remain compile-only guards and do not mutate a fixture.
    // @ts-expect-error Semantic value identity is immutable.
    erased.typeId = "replacement.type";
    // @ts-expect-error Schema identity is immutable when declared.
    erased.schemaId = "replacement-schema";
    // @ts-expect-error The enclosed payload reference cannot be replaced.
    erased.value = undefined;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
