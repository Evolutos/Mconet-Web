// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import { ModelInteractionError, type MediaType } from "@evolutos/mconet-core-domain";
import type { ComponentTypeContract } from "@evolutos/mconet-core-spi";

import { validateComponentTypeConnection } from "./validate-component-type-connection.js";

const jsonMediaType: MediaType = {
  type: "application",
  subtype: "json",
  parameters: { charset: "utf-8", profile: "payload" },
};
const problemMediaType: MediaType = {
  type: "application",
  subtype: "problem+json",
  parameters: { charset: "utf-8" },
};

it("exposes one exact adjacent-contract validation signature", () => {
  // The validator receives contracts rather than component instances, payloads,
  // plans, capabilities, or configurable comparison behavior.
  expectTypeOf(validateComponentTypeConnection).toEqualTypeOf<
    (
      input: Readonly<{
        readonly producer: ComponentTypeContract;
        readonly consumer: ComponentTypeContract;
      }>,
    ) => void
  >();
});

it("accepts matching semantic types without optional consumer constraints", () => {
  const producer: ComponentTypeContract = {
    outputTypeId: "protocol.payload",
    outputSchemaId: "schema.protocol.payload.v1",
    outputMediaTypes: [jsonMediaType],
  };
  const consumer: ComponentTypeContract = {
    inputTypeId: "protocol.payload",
  };

  // An omitted consumer Schema and media collection accept any producer evidence
  // for the required semantic type; validation does not rewrite either contract.
  expect(validateComponentTypeConnection({ producer, consumer })).toBeUndefined();
  expect(producer.outputSchemaId).toBe("schema.protocol.payload.v1");
  expect(producer.outputMediaTypes?.[0]).toBe(jsonMediaType);
  expect(consumer).toEqual({ inputTypeId: "protocol.payload" });
});

it("accepts producer media types assignable to a broader consumer set", () => {
  const equivalentJsonMediaType: MediaType = {
    type: "application",
    subtype: "json",
    parameters: { profile: "payload", charset: "utf-8" },
  };
  const producer: ComponentTypeContract = {
    outputTypeId: "protocol.payload",
    outputSchemaId: "schema.protocol.payload.v1",
    outputMediaTypes: [jsonMediaType, problemMediaType],
  };
  const consumer: ComponentTypeContract = {
    inputTypeId: "protocol.payload",
    inputSchemaId: "schema.protocol.payload.v1",
    inputMediaTypes: [
      problemMediaType,
      equivalentJsonMediaType,
      { type: "text", subtype: "plain", parameters: {} },
    ],
  };

  // Every possible producer representation appears in the consumer's accepted
  // set. Parameter insertion order and array order do not affect compatibility.
  expect(validateComponentTypeConnection({ producer, consumer })).toBeUndefined();
  expect(producer.outputMediaTypes).toEqual([jsonMediaType, problemMediaType]);
  expect(consumer.inputMediaTypes?.[1]).toBe(equivalentJsonMediaType);
});

it("ignores the producer input and consumer output sides", () => {
  const producer: ComponentTypeContract = {
    inputTypeId: "unrelated.producer.input",
    inputSchemaId: "schema.unrelated.producer.input",
    inputMediaTypes: [{ type: "text", subtype: "plain", parameters: {} }],
    outputTypeId: "connected.payload",
  };
  const consumer: ComponentTypeContract = {
    inputTypeId: "connected.payload",
    outputTypeId: "unrelated.consumer.output",
    outputSchemaId: "schema.unrelated.consumer.output",
    outputMediaTypes: [problemMediaType],
  };

  // Connection direction is producer output to consumer input only. Opposite
  // port declarations cannot create a false mismatch or substitute evidence.
  expect(validateComponentTypeConnection({ producer, consumer })).toBeUndefined();
});

it.each([
  [
    "producer output",
    {} satisfies ComponentTypeContract,
    { inputTypeId: "protocol.payload" } satisfies ComponentTypeContract,
  ],
  [
    "consumer input",
    { outputTypeId: "protocol.payload" } satisfies ComponentTypeContract,
    {} satisfies ComponentTypeContract,
  ],
] as const)("rejects a connection missing the %s semantic type", (_side, producer, consumer) => {
  const error = captureInteractionError(() => {
    // An active connection needs evidence from both directions; the validator
    // must not infer a missing type from Schema, media, or the opposite port.
    validateComponentTypeConnection({ producer, consumer });
  });

  expectInvalidContractError(error, "type_id");
});

it("rejects different semantic type identities", () => {
  const error = captureInteractionError(() => {
    // Open identifiers remain exact portable identities and are never matched by
    // prefixes, names, descriptor metadata, or structural payload guesses.
    validateComponentTypeConnection({
      producer: { outputTypeId: "protocol.response" },
      consumer: { inputTypeId: "protocol.error" },
    });
  });

  expectInvalidContractError(error, "type_id");
});

it.each([
  ["missing producer Schema", { outputTypeId: "protocol.payload" } satisfies ComponentTypeContract],
  [
    "different producer Schema",
    {
      outputTypeId: "protocol.payload",
      outputSchemaId: "schema.protocol.other.v1",
    } satisfies ComponentTypeContract,
  ],
] as const)("rejects %s when the consumer constrains Schema", (_case, producer) => {
  const error = captureInteractionError(() => {
    // Consumer input requirements are directional. Missing producer evidence and
    // an explicitly different Schema both fail before runtime value narrowing.
    validateComponentTypeConnection({
      producer,
      consumer: {
        inputTypeId: "protocol.payload",
        inputSchemaId: "schema.protocol.payload.v1",
      },
    });
  });

  expectInvalidContractError(error, "schema_id");
});

it.each([
  ["missing producer media declarations", undefined, [jsonMediaType]],
  ["empty producer media declarations", [], [jsonMediaType]],
  ["empty consumer media declarations", [jsonMediaType], []],
  ["different producer representation", [problemMediaType], [jsonMediaType]],
  [
    "partially accepted producer representations",
    [jsonMediaType, problemMediaType],
    [jsonMediaType],
  ],
] as const)(
  "rejects %s",
  (
    _case,
    outputMediaTypes: readonly MediaType[] | undefined,
    inputMediaTypes: readonly MediaType[],
  ) => {
    const producer: ComponentTypeContract = {
      outputTypeId: "protocol.payload",
      ...(outputMediaTypes === undefined ? {} : { outputMediaTypes }),
    };
    const error = captureInteractionError(() => {
      // Once a consumer declares accepted representations, every representation
      // the producer may emit needs explicit structural acceptance.
      validateComponentTypeConnection({
        producer,
        consumer: { inputTypeId: "protocol.payload", inputMediaTypes },
      });
    });

    expectInvalidContractError(error, "media_type");
  },
);

it("does not mutate frozen contracts or media collections", () => {
  const outputMediaTypes = Object.freeze([jsonMediaType]);
  const inputMediaTypes = Object.freeze([
    {
      type: jsonMediaType.type,
      subtype: jsonMediaType.subtype,
      parameters: { profile: "payload", charset: "utf-8" },
    },
  ]);
  const producer: ComponentTypeContract = Object.freeze({
    outputTypeId: "protocol.payload",
    outputMediaTypes,
  });
  const consumer: ComponentTypeContract = Object.freeze({
    inputTypeId: "protocol.payload",
    inputMediaTypes,
  });

  // Successful validation reads immutable evidence only. Frozen fixtures would
  // throw if the implementation sorted, normalized, or appended to either set.
  expect(validateComponentTypeConnection({ producer, consumer })).toBeUndefined();
  expect(producer.outputMediaTypes).toBe(outputMediaTypes);
  expect(consumer.inputMediaTypes).toBe(inputMediaTypes);
});

/** Verifies the common safe error envelope and one failed connection aspect. */
function expectInvalidContractError(
  error: ModelInteractionError,
  aspect: "type_id" | "schema_id" | "media_type",
): void {
  // Error details intentionally omit actual identifiers and media values while
  // retaining a stable programmatic reason for the failed validation.
  expect(error).toMatchObject({
    category: "invalid_component_configuration",
    phase: "component_type_validation",
    code: "invalid_component_type_contract",
    diagnostics: [
      {
        code: "invalid_component_type_contract",
        severity: "error",
        phase: "component_type_validation",
        details: { aspect },
      },
    ],
  });
}

/** Captures one expected classified connection failure without a type assertion. */
function captureInteractionError(action: () => void): ModelInteractionError {
  try {
    // Execute exactly once so error allocation and contract reads are deterministic.
    action();
  } catch (error) {
    if (error instanceof ModelInteractionError) {
      return error;
    }
    // Preserve an unexpected implementation failure as the assertion cause.
    throw new Error("Expected ModelInteractionError.", { cause: error });
  }

  throw new Error("Expected component type connection validation to fail.");
}
