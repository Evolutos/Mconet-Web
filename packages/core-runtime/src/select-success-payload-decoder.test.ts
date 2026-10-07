// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import { ModelInteractionError, type MediaType } from "@evolutos/mconet-core-domain";
import type {
  ComponentDescriptor,
  ComponentTypeContract,
  DecoderSelection,
  PayloadDecoder,
  RuntimeComponent,
} from "@evolutos/mconet-core-spi";

import { selectSuccessPayloadDecoder } from "./select-success-payload-decoder.js";

const plannedMediaType: MediaType = {
  type: "application",
  subtype: "json",
  parameters: { charset: "utf-8", profile: "success" },
};
const plannedSchemaId = "schema.protocol.success.v1";
const plannedSelection: DecoderSelection = {
  mediaType: plannedMediaType,
  schemaId: plannedSchemaId,
};

it("exposes one exact success Decoder selection signature", () => {
  // The function receives only success-path criteria and the four fixed source
  // tiers; response metadata, bytes, error Decoder, and execution remain absent.
  expectTypeOf(selectSuccessPayloadDecoder).toEqualTypeOf<
    (
      input: Readonly<{
        readonly selection: DecoderSelection;
        readonly interactionDecoder?: PayloadDecoder;
        readonly clientDecoder?: PayloadDecoder;
        readonly integrationDecoders: readonly RuntimeComponent[];
        readonly sdkDefaultDecoder?: PayloadDecoder;
      }>,
    ) => PayloadDecoder
  >();
});

it("returns the compatible interaction Decoder without inspecting lower tiers", () => {
  const interactionDecoder = createDecoder("interaction", createMatchingContract());
  const clientDecoder = createUnreadableDecoder();
  const integrationDecoder = createUnreadableDecoder();
  const sdkDefaultDecoder = createUnreadableDecoder();

  // A direct interaction choice is final. Lower descriptor access would throw,
  // proving those candidates cannot affect selection or validation.
  expect(
    selectSuccessPayloadDecoder({
      selection: plannedSelection,
      interactionDecoder,
      clientDecoder,
      integrationDecoders: [integrationDecoder],
      sdkDefaultDecoder,
    }),
  ).toBe(interactionDecoder);
});

it("returns the compatible Client Decoder before integration and the SDK default", () => {
  const clientDecoder = createDecoder("client", createMatchingContract());

  // With no interaction override, the Client's direct instance remains final;
  // unreadable lower descriptors prove the wrapper preserves lazy precedence.
  expect(
    selectSuccessPayloadDecoder({
      selection: plannedSelection,
      clientDecoder,
      integrationDecoders: [createUnreadableDecoder()],
      sdkDefaultDecoder: createUnreadableDecoder(),
    }),
  ).toBe(clientDecoder);
});

it("filters integration candidates by Decoder input media type and output Schema", () => {
  const wrongMediaDirection = createDecoder("wrong-media-direction", {
    outputMediaTypes: [plannedMediaType],
    outputSchemaId: plannedSchemaId,
  });
  const wrongSchemaDirection = createDecoder("wrong-schema-direction", {
    inputMediaTypes: [createEquivalentPlannedMediaType()],
    inputSchemaId: plannedSchemaId,
    outputSchemaId: "schema.protocol.other.v1",
  });
  const missingMediaParameter = createDecoder("missing-media-parameter", {
    inputMediaTypes: [{ type: "application", subtype: "json", parameters: { charset: "utf-8" } }],
    outputSchemaId: plannedSchemaId,
  });
  const differentMediaParameter = createDecoder("different-media-parameter", {
    inputMediaTypes: [
      {
        type: "application",
        subtype: "json",
        parameters: { charset: "utf-8", profile: "different" },
      },
    ],
    outputSchemaId: plannedSchemaId,
  });
  const matchingDecoder = createDecoder("matching", createMatchingContract());
  const integrationDecoders = [
    wrongMediaDirection,
    missingMediaParameter,
    matchingDecoder,
    differentMediaParameter,
    wrongSchemaDirection,
  ] as const;

  const selected = selectSuccessPayloadDecoder({
    selection: plannedSelection,
    integrationDecoders,
  });

  // Parameter insertion order differs in the matching declaration, but names and
  // decoded values are structurally equal. Wrong port directions never substitute.
  expect(selected).toBe(matchingDecoder);
  expect(integrationDecoders).toEqual([
    wrongMediaDirection,
    missingMediaParameter,
    matchingDecoder,
    differentMediaParameter,
    wrongSchemaDirection,
  ]);
});

it("matches independently omitted media type and Schema criteria", () => {
  const mediaOnlyDecoder = createDecoder("media-only", {
    inputMediaTypes: [createEquivalentPlannedMediaType()],
  });
  const schemaOnlyDecoder = createDecoder("schema-only", {
    outputSchemaId: plannedSchemaId,
  });

  // Each criterion constrains only its own port evidence. Absence never invents
  // a requirement for the other field or forces a placeholder declaration.
  expect(
    selectSuccessPayloadDecoder({
      selection: { mediaType: plannedMediaType },
      integrationDecoders: [mediaOnlyDecoder],
    }),
  ).toBe(mediaOnlyDecoder);
  expect(
    selectSuccessPayloadDecoder({
      selection: { schemaId: plannedSchemaId },
      integrationDecoders: [schemaOnlyDecoder],
    }),
  ).toBe(schemaOnlyDecoder);
});

it("uses a compatible SDK default only when no integration Decoder matches", () => {
  const undeclaredIntegrationDecoder = createDecoder("undeclared");
  const incompatibleIntegrationDecoder = createDecoder("incompatible", {
    inputMediaTypes: [
      { type: "application", subtype: "problem+json", parameters: { charset: "utf-8" } },
    ],
    outputSchemaId: plannedSchemaId,
  });
  const sdkDefaultDecoder = createDecoder("default", createMatchingContract());

  // Missing contract evidence and an incompatible declaration are not winners.
  // The concrete default is validated against the same criteria before return.
  expect(
    selectSuccessPayloadDecoder({
      selection: plannedSelection,
      integrationDecoders: [undeclaredIntegrationDecoder, incompatibleIntegrationDecoder],
      sdkDefaultDecoder,
    }),
  ).toBe(sdkDefaultDecoder);
});

it("accepts one correctly shaped Decoder when success criteria are unconstrained", () => {
  const decoderWithoutTypeContract = createDecoder("unconstrained");

  // With no planned media type or Schema, descriptor type evidence cannot affect
  // compatibility and its absence must not fabricate a mismatch.
  expect(
    selectSuccessPayloadDecoder({
      selection: {},
      integrationDecoders: [decoderWithoutTypeContract],
    }),
  ).toBe(decoderWithoutTypeContract);
});

it("rejects an incompatible explicit Decoder without falling back", () => {
  const interactionDecoder = createDecoder("incompatible-interaction", {
    inputMediaTypes: [plannedMediaType],
    outputSchemaId: "schema.protocol.other.v1",
  });
  const compatibleClientDecoder = createDecoder("compatible-client", createMatchingContract());
  const error = captureInteractionError(() => {
    // The compatible Client value is deliberately present, but a mismatched
    // interaction override must fail instead of being silently replaced.
    selectSuccessPayloadDecoder({
      selection: plannedSelection,
      interactionDecoder,
      clientDecoder: compatibleClientDecoder,
      integrationDecoders: [createUnreadableDecoder()],
    });
  });

  expect(error).toMatchObject({
    category: "invalid_component_configuration",
    phase: "component_type_validation",
    code: "component_type_mismatch",
    diagnostics: [
      {
        code: "component_type_mismatch",
        severity: "error",
        phase: "component_type_validation",
        details: {
          roleId: "codec.response.success-decoder",
          mediaTypeRequired: true,
          schemaIdRequired: true,
        },
      },
    ],
  });
});

it("rejects multiple compatible integration Decoders without using declaration order", () => {
  const first = createDecoder("first", createMatchingContract());
  const second = createDecoder("second", createMatchingContract());
  const candidates = [first, second] as const;
  const error = captureInteractionError(() => {
    // Both candidates satisfy the same tier and plan. No metadata or list order
    // is permitted to invent a winner.
    selectSuccessPayloadDecoder({ selection: plannedSelection, integrationDecoders: candidates });
  });

  expect(error).toMatchObject({
    category: "invalid_component_configuration",
    phase: "resolution",
    code: "ambiguous_component_selection",
    diagnostics: [
      {
        details: { roleId: "codec.response.success-decoder", candidateCount: 2 },
      },
    ],
  });
  expect(candidates).toEqual([first, second]);
});

it("reports absence when no compatible success Decoder or default exists", () => {
  const incompatibleDecoder = createDecoder("incompatible", {
    inputMediaTypes: [plannedMediaType],
    outputSchemaId: "schema.protocol.other.v1",
  });
  const error = captureInteractionError(() => {
    // Filtering leaves the active integration tier empty and there is no lower
    // default, so the shared required-role error must identify the success role.
    selectSuccessPayloadDecoder({
      selection: plannedSelection,
      integrationDecoders: [incompatibleDecoder],
    });
  });

  expect(error).toMatchObject({
    category: "invalid_component_configuration",
    phase: "resolution",
    code: "component_not_found",
    diagnostics: [
      {
        details: { roleId: "codec.response.success-decoder" },
      },
    ],
  });
});

it("rejects a type-erased integration candidate without Decoder behavior", () => {
  const malformedCandidate: RuntimeComponent = {
    descriptor: {
      name: "not-a-decoder",
      version: "1.0.0",
      typeContract: createMatchingContract(),
      capabilities: new Set(),
      source: "plugin",
    },
  };
  const error = captureInteractionError(() => {
    // Descriptor compatibility cannot make a component callable. The malformed
    // active-tier candidate must fail before a lower default can hide it.
    selectSuccessPayloadDecoder({
      selection: plannedSelection,
      integrationDecoders: [malformedCandidate],
      sdkDefaultDecoder: createDecoder("default", createMatchingContract()),
    });
  });

  expect(error).toMatchObject({
    category: "invalid_component_configuration",
    phase: "component_type_validation",
    code: "invalid_component_type_contract",
    diagnostics: [
      {
        code: "invalid_component_type_contract",
        severity: "error",
        phase: "component_type_validation",
        details: { roleId: "codec.response.success-decoder" },
      },
    ],
  });
});

/** Creates a media type equal to the plan but with reversed parameter insertion order. */
function createEquivalentPlannedMediaType(): MediaType {
  // A fresh value proves matching is structural rather than based on object
  // identity or Record insertion order.
  return {
    type: plannedMediaType.type,
    subtype: plannedMediaType.subtype,
    parameters: { profile: "success", charset: "utf-8" },
  };
}

/** Creates the complete port declaration required by the success plan. */
function createMatchingContract(): ComponentTypeContract {
  // Only Decoder input media and output Schema are relevant. Keeping unrelated
  // port fields absent makes accidental use of the opposite direction visible.
  return {
    inputMediaTypes: [createEquivalentPlannedMediaType()],
    outputSchemaId: plannedSchemaId,
  };
}

/** Creates one inert Decoder with optional port metadata. */
function createDecoder(name: string, typeContract?: ComponentTypeContract): PayloadDecoder {
  const descriptor: ComponentDescriptor =
    typeContract === undefined
      ? { name, version: "1.0.0", capabilities: new Set(), source: "plugin" }
      : {
          name,
          version: "1.0.0",
          typeContract,
          capabilities: new Set(),
          source: "plugin",
        };

  return {
    descriptor,
    decode() {
      // Selection is synchronous metadata resolution and must never execute the
      // behavior it is fixing for later network response handling.
      throw new Error("success Decoder must not execute during selection");
    },
  };
}

/** Creates a lower-tier Decoder whose descriptor must remain unobserved. */
function createUnreadableDecoder(): PayloadDecoder {
  return {
    get descriptor(): never {
      // Throwing access proves a higher final choice suppresses lower-tier
      // filtering, validation, ranking, and diagnostic reads.
      throw new Error("lower-tier descriptor must not be read");
    },
    decode() {
      // Behavior exists only to satisfy the Decoder boundary and must not execute
      // during pre-I/O component selection.
      throw new Error("lower-tier Decoder must not execute during selection");
    },
  };
}

/** Captures one expected classified component-selection failure safely. */
function captureInteractionError(action: () => void): ModelInteractionError {
  try {
    // Invoke the selection once so candidate access and error allocation remain
    // deterministic in every negative test.
    action();
  } catch (error) {
    if (error instanceof ModelInteractionError) {
      return error;
    }
    // Preserve unexpected failure identity without an assertion or unsafe cast.
    throw new Error("Expected ModelInteractionError.", { cause: error });
  }

  throw new Error("Expected success Decoder selection to fail.");
}
