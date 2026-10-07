// Copyright © 2026 Mcont.

import { ModelInteractionError, type MediaType } from "@evolutos/mconet-core-domain";
import type { ComponentTypeContract } from "@evolutos/mconet-core-spi";

import { mediaTypesEqual } from "./media-types-equal.js";

/**
 * Validates one producer-output to consumer-input component connection.
 *
 * Both sides must declare their connected semantic type and those identities
 * must match exactly. Consumer Schema and media declarations are directional
 * constraints: omission accepts any producer value of the matching semantic
 * type, while a declared constraint requires corresponding producer evidence.
 * Producer media representations are assignable only when every representation
 * it may emit is accepted by the consumer. The function performs no conversion,
 * component lookup, payload narrowing, capability check, or runtime execution.
 *
 * @param input Producer and consumer port contracts for one adjacent connection.
 * @throws {ModelInteractionError} With `invalid_component_type_contract` when
 * required evidence is absent or the connected ports are incompatible.
 */
export function validateComponentTypeConnection(
  input: Readonly<{
    readonly producer: ComponentTypeContract;
    readonly consumer: ComponentTypeContract;
  }>,
): void {
  const producerTypeId = input.producer.outputTypeId;
  const consumerTypeId = input.consumer.inputTypeId;

  // Semantic type evidence is mandatory on both connected sides. Optional
  // contract fields support one-sided components, not untyped active ports.
  if (
    producerTypeId === undefined ||
    consumerTypeId === undefined ||
    producerTypeId !== consumerTypeId
  ) {
    throw createInvalidConnectionError("type_id");
  }

  const consumerSchemaId = input.consumer.inputSchemaId;
  if (consumerSchemaId !== undefined && input.producer.outputSchemaId !== consumerSchemaId) {
    // A consumer Schema is a required input shape. Missing producer evidence is
    // indistinguishable from a different Schema and cannot be inferred as safe.
    throw createInvalidConnectionError("schema_id");
  }

  if (
    !areOutputMediaTypesAssignable(input.producer.outputMediaTypes, input.consumer.inputMediaTypes)
  ) {
    throw createInvalidConnectionError("media_type");
  }
}

/** Determines directional assignability between producer and consumer media sets. */
function areOutputMediaTypesAssignable(
  outputMediaTypes: readonly MediaType[] | undefined,
  inputMediaTypes: readonly MediaType[] | undefined,
): boolean {
  // An omitted consumer collection imposes no wire-representation constraint;
  // semantic type and any declared Schema remain independently enforced.
  if (inputMediaTypes === undefined) {
    return true;
  }

  // A declared consumer collection requires explicit producer evidence. Empty
  // input or output sets cannot establish any usable representation connection.
  if (
    outputMediaTypes === undefined ||
    outputMediaTypes.length === 0 ||
    inputMediaTypes.length === 0
  ) {
    return false;
  }

  // The producer may emit any declared output representation, so every member
  // must be accepted by at least one structurally equal consumer input member.
  return outputMediaTypes.every((outputMediaType) =>
    inputMediaTypes.some((inputMediaType) => mediaTypesEqual(outputMediaType, inputMediaType)),
  );
}

/** Creates a content-safe failure for one incompatible contract aspect. */
function createInvalidConnectionError(
  aspect: "type_id" | "schema_id" | "media_type",
): ModelInteractionError {
  // Values themselves may be integration-defined and are unnecessary for
  // classification. Report only the failed aspect and stable connection phase.
  return new ModelInteractionError({
    message: "Adjacent component type contracts are incompatible.",
    category: "invalid_component_configuration",
    phase: "component_type_validation",
    code: "invalid_component_type_contract",
    diagnostics: [
      {
        code: "invalid_component_type_contract",
        severity: "error",
        phase: "component_type_validation",
        message: "A producer output cannot connect to the adjacent consumer input.",
        details: { aspect },
      },
    ],
  });
}
