// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import { expect, expectTypeOf, it } from "vitest";

import type { ErasedRuntimeValue } from "./erased-runtime-value.js";
import { narrowErasedRuntimeValue } from "./narrow-erased-runtime-value.js";

interface TextPayload {
  readonly text: string;
}

it("returns the exact payload after one successful runtime guard", () => {
  const payload: TextPayload = { text: "retained" };
  const erased: ErasedRuntimeValue = {
    typeId: "vendor.text_payload",
    schemaId: "https://schemas.example.test/text.json",
    value: payload,
  };
  let guardCallCount = 0;

  const result = narrowErasedRuntimeValue(erased, (value): value is TextPayload => {
    // A total structural guard owns runtime-shape proof after the caller has
    // separately validated portable component type and Schema identities.
    guardCallCount += 1;
    return hasTextPayloadShape(value);
  });

  // Identity and the call count prove the helper neither copies the payload nor
  // invokes the consumer's guard more than once.
  expect(result).toBe(payload);
  expect(result.text).toBe("retained");
  expect(guardCallCount).toBe(1);
});

it("normalizes a false guard result without exposing producer data", () => {
  const privateTypeId = "vendor.private_payload";
  const privateSchemaId = "private-schema-token";
  const privateMarker = "private-payload-marker";
  const erased: ErasedRuntimeValue = {
    typeId: privateTypeId,
    schemaId: privateSchemaId,
    value: { marker: privateMarker },
  };

  const captureFailure = (): ModelInteractionError => {
    try {
      narrowErasedRuntimeValue(erased, (value): value is Uint8Array => value instanceof Uint8Array);
    } catch (error) {
      // The helper promises one normalized domain error rather than a TypeError
      // or the producer's arbitrary thrown value.
      expect(error).toBeInstanceOf(ModelInteractionError);
      return error as ModelInteractionError;
    }
    throw new Error("Expected runtime narrowing to fail.");
  };

  const error = captureFailure();
  expect(error).toMatchObject({
    name: "ModelInteractionError",
    category: "invalid_component_configuration",
    phase: "component_type_validation",
    code: "component_type_mismatch",
    message: "Erased runtime value does not match the requested runtime type.",
    diagnostics: [],
  });
  expect(Object.hasOwn(error, "cause")).toBe(false);
  const serialized = JSON.stringify(error);
  expect(serialized).not.toContain(privateTypeId);
  expect(serialized).not.toContain(privateSchemaId);
  expect(serialized).not.toContain(privateMarker);
});

it("normalizes a guard exception without retaining it as a cause", () => {
  const guardFailure = new TypeError("private guard failure");
  const erased: ErasedRuntimeValue = {
    typeId: "vendor.payload",
    value: {},
  };

  const invoke = (): void => {
    narrowErasedRuntimeValue(erased, (value): value is TextPayload => {
      // A component-supplied guard may fail while inspecting a hostile or
      // unexpected platform value; the boundary must still normalize the error.
      void value;
      throw guardFailure;
    });
  };

  try {
    invoke();
    throw new Error("Expected exceptional guard normalization.");
  } catch (error) {
    expect(error).toBeInstanceOf(ModelInteractionError);
    expect(error).not.toBe(guardFailure);
    expect((error as ModelInteractionError).code).toBe("component_type_mismatch");
    expect(Object.hasOwn(error as object, "cause")).toBe(false);
    expect(String(error)).not.toContain("private guard failure");
  }
});

it("reads the erased payload once and does not inspect portable metadata", () => {
  const payload: TextPayload = { text: "single read" };
  let valueReadCount = 0;
  let metadataReadCount = 0;
  const erased = {
    get typeId(): never {
      metadataReadCount += 1;
      throw new Error("typeId must not be read");
    },
    get schemaId(): never {
      metadataReadCount += 1;
      throw new Error("schemaId must not be read");
    },
    get value(): TextPayload {
      valueReadCount += 1;
      return payload;
    },
  } as ErasedRuntimeValue;

  // Metadata compatibility belongs to the earlier ComponentTypeContract check;
  // this helper performs only the final runtime shape proof.
  expect(narrowErasedRuntimeValue(erased, hasTextPayloadShape)).toBe(payload);
  expect(valueReadCount).toBe(1);
  expect(metadataReadCount).toBe(0);
});

it("creates independent normalized errors for repeated mismatches", () => {
  const erased: ErasedRuntimeValue = { typeId: "vendor.payload", value: null };
  const capture = (): ModelInteractionError => {
    try {
      narrowErasedRuntimeValue(erased, hasTextPayloadShape);
    } catch (error) {
      return error as ModelInteractionError;
    }
    throw new Error("Expected runtime narrowing to fail.");
  };

  const first = capture();
  const second = capture();
  expect(first).not.toBe(second);
  expect(first.diagnostics).not.toBe(second.diagnostics);
  expect(first.code).toBe(second.code);
});

it("exposes one generic type-guard narrowing signature", () => {
  expectTypeOf(narrowErasedRuntimeValue).toEqualTypeOf<
    <Value>(erased: ErasedRuntimeValue, isValue: (value: unknown) => value is Value) => Value
  >();
});

/** Determines whether an unknown value is one complete text payload. */
function hasTextPayloadShape(value: unknown): value is TextPayload {
  // Reject primitives and arrays before the only property read; the guarded
  // record view remains local to this test fixture rather than the SPI helper.
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "text" in value &&
    typeof value.text === "string"
  );
}
