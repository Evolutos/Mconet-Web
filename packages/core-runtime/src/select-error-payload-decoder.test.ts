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

import { selectErrorPayloadDecoder } from "./select-error-payload-decoder.js";
import { selectSuccessPayloadDecoder } from "./select-success-payload-decoder.js";

const errorMediaType: MediaType = {
  type: "application",
  subtype: "problem+json",
  parameters: { charset: "utf-8" },
};
const errorSchemaId = "schema.protocol.error.v1";
const errorSelection: DecoderSelection = {
  mediaType: errorMediaType,
  schemaId: errorSchemaId,
};

it("exposes one exact error Decoder selection signature", () => {
  // The error wrapper receives its own criteria and source tiers. Success
  // Decoder state, response metadata, bytes, and execution remain absent.
  expectTypeOf(selectErrorPayloadDecoder).toEqualTypeOf<
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

it("returns the error interaction Decoder without inspecting lower tiers", () => {
  const interactionDecoder = createDecoder("interaction-error", createErrorContract());

  // A per-interaction error Decoder is final. Unreadable lower descriptors prove
  // that success-independent precedence remains lazy at the wrapper boundary.
  expect(
    selectErrorPayloadDecoder({
      selection: errorSelection,
      interactionDecoder,
      clientDecoder: createUnreadableDecoder(),
      integrationDecoders: [createUnreadableDecoder()],
      sdkDefaultDecoder: createUnreadableDecoder(),
    }),
  ).toBe(interactionDecoder);
});

it("selects error and success Decoders independently from one Integration tier", () => {
  const successMediaType: MediaType = {
    type: "application",
    subtype: "json",
    parameters: { charset: "utf-8" },
  };
  const successSchemaId = "schema.protocol.success.v1";
  const successDecoder = createDecoder("success", {
    inputMediaTypes: [successMediaType],
    outputSchemaId: successSchemaId,
  });
  const errorDecoder = createDecoder("error", createErrorContract());
  const integrationDecoders = [successDecoder, errorDecoder] as const;

  // Both selectors inspect the same candidate identities with different plans.
  // Neither path borrows the other's chosen instance or criteria.
  expect(selectErrorPayloadDecoder({ selection: errorSelection, integrationDecoders })).toBe(
    errorDecoder,
  );
  expect(
    selectSuccessPayloadDecoder({
      selection: { mediaType: successMediaType, schemaId: successSchemaId },
      integrationDecoders,
    }),
  ).toBe(successDecoder);
});

it("uses the SDK error Decoder only after Integration has no compatible candidate", () => {
  const successOnlyIntegrationDecoder = createDecoder("success-only", {
    inputMediaTypes: [{ type: "application", subtype: "json", parameters: { charset: "utf-8" } }],
    outputSchemaId: "schema.protocol.success.v1",
  });
  const sdkDefaultDecoder = createDecoder("default-error", createErrorContract());

  // The incompatible Integration value cannot be decoded as an error payload;
  // the concrete error default is independently validated before return.
  expect(
    selectErrorPayloadDecoder({
      selection: errorSelection,
      integrationDecoders: [successOnlyIntegrationDecoder],
      sdkDefaultDecoder,
    }),
  ).toBe(sdkDefaultDecoder);
});

it("rejects an incompatible explicit error Decoder without success-path fallback", () => {
  const incompatibleInteractionDecoder = createDecoder("wrong-error", {
    inputMediaTypes: [errorMediaType],
    outputSchemaId: "schema.protocol.success.v1",
  });
  const compatibleClientDecoder = createDecoder("client-error", createErrorContract());
  const error = captureInteractionError(() => {
    // A compatible lower Client Decoder exists deliberately. The final explicit
    // interaction choice must fail instead of being replaced.
    selectErrorPayloadDecoder({
      selection: errorSelection,
      interactionDecoder: incompatibleInteractionDecoder,
      clientDecoder: compatibleClientDecoder,
      integrationDecoders: [],
    });
  });

  expect(error).toMatchObject({
    category: "invalid_component_configuration",
    phase: "component_type_validation",
    code: "component_type_mismatch",
    diagnostics: [
      {
        code: "component_type_mismatch",
        details: {
          roleId: "codec.response.error-decoder",
          mediaTypeRequired: true,
          schemaIdRequired: true,
        },
      },
    ],
  });
});

it("rejects multiple compatible error Decoders without choosing by order", () => {
  const first = createDecoder("first-error", createErrorContract());
  const second = createDecoder("second-error", createErrorContract());
  const candidates = [first, second] as const;
  const error = captureInteractionError(() => {
    // Equal-tier matches remain ambiguous even if their descriptor names and
    // declaration positions differ.
    selectErrorPayloadDecoder({ selection: errorSelection, integrationDecoders: candidates });
  });

  expect(error).toMatchObject({
    category: "invalid_component_configuration",
    phase: "resolution",
    code: "ambiguous_component_selection",
    diagnostics: [
      {
        details: { roleId: "codec.response.error-decoder", candidateCount: 2 },
      },
    ],
  });
  expect(candidates).toEqual([first, second]);
});

it("reports the error role when no compatible Decoder exists", () => {
  const incompatibleDecoder = createDecoder("success-only", {
    inputMediaTypes: [errorMediaType],
    outputSchemaId: "schema.protocol.success.v1",
  });
  const error = captureInteractionError(() => {
    // The active Integration tier becomes empty after error-plan matching and no
    // SDK error default exists.
    selectErrorPayloadDecoder({
      selection: errorSelection,
      integrationDecoders: [incompatibleDecoder],
    });
  });

  expect(error).toMatchObject({
    category: "invalid_component_configuration",
    phase: "resolution",
    code: "component_not_found",
    diagnostics: [
      {
        details: { roleId: "codec.response.error-decoder" },
      },
    ],
  });
});

it("reports the error role for a malformed type-erased Decoder candidate", () => {
  const malformedCandidate: RuntimeComponent = {
    descriptor: {
      name: "not-an-error-decoder",
      version: "1.0.0",
      typeContract: createErrorContract(),
      capabilities: new Set(),
      source: "plugin",
    },
  };
  const error = captureInteractionError(() => {
    // A matching descriptor cannot substitute for the missing Decoder method.
    // The active malformed tier must not be hidden by a valid lower default.
    selectErrorPayloadDecoder({
      selection: errorSelection,
      integrationDecoders: [malformedCandidate],
      sdkDefaultDecoder: createDecoder("default-error", createErrorContract()),
    });
  });

  expect(error).toMatchObject({
    category: "invalid_component_configuration",
    phase: "component_type_validation",
    code: "invalid_component_type_contract",
    diagnostics: [
      {
        code: "invalid_component_type_contract",
        details: { roleId: "codec.response.error-decoder" },
      },
    ],
  });
});

/** Creates the complete input-media and output-Schema contract for error payloads. */
function createErrorContract(): ComponentTypeContract {
  // Return a fresh media value so compatibility depends on structural evidence,
  // not object identity shared with the plan fixture.
  return {
    inputMediaTypes: [
      {
        type: errorMediaType.type,
        subtype: errorMediaType.subtype,
        parameters: { charset: "utf-8" },
      },
    ],
    outputSchemaId: errorSchemaId,
  };
}

/** Creates one nonexecuting Decoder fixture with optional port metadata. */
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
      // Decoder execution belongs after transport outcome dispatch. Any call in
      // this selection suite is an immediate orchestration failure.
      throw new Error("error Decoder must not execute during selection");
    },
  };
}

/** Creates a lower-tier Decoder whose descriptor must not be inspected. */
function createUnreadableDecoder(): PayloadDecoder {
  return {
    get descriptor(): never {
      // Throwing access proves a higher direct error Decoder suppresses all lower
      // candidate matching and diagnostics.
      throw new Error("lower-tier error Decoder descriptor must not be read");
    },
    decode() {
      // This behavior exists only to satisfy the SPI and must remain uncalled.
      throw new Error("lower-tier error Decoder must not execute during selection");
    },
  };
}

/** Captures one expected classified error-Decoder selection failure safely. */
function captureInteractionError(action: () => void): ModelInteractionError {
  try {
    // Execute once so candidate access, fallback behavior, and error identity are
    // deterministic for every negative path.
    action();
  } catch (error) {
    if (error instanceof ModelInteractionError) {
      return error;
    }
    // Retain an unexpected error as the test assertion cause without casting.
    throw new Error("Expected ModelInteractionError.", { cause: error });
  }

  throw new Error("Expected error Decoder selection to fail.");
}
