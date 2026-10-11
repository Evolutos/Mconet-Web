// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type { ComponentTypeContract } from "../../packages/core-spi/src/component-type-contract.js";
import { validateComponentTypeConnection } from "../../packages/core-runtime/src/validate-component-type-connection.js";
import { jsonPayloadEncoderTypeContract } from "../../packages/codec-json/src/json-payload-encoder-descriptor.js";

/** Adapter output that emits the JSON value port as `application/json`. */
const adapterPayloadContract: ComponentTypeContract = {
  outputTypeId: "json.value",
  outputSchemaId: "schema://json.contract/object/1",
  outputMediaTypes: [{ type: "application", subtype: "json", parameters: {} }],
};

it("connects an adapter JSON payload to the encoder input port", () => {
  // Schema identity stays on the adapter. The encoder does not require one.
  expect(() =>
    validateComponentTypeConnection({
      producer: adapterPayloadContract,
      consumer: jsonPayloadEncoderTypeContract,
    }),
  ).not.toThrow();
});

it("rejects an adapter payload whose type or media type is not JSON", () => {
  expect(() =>
    validateComponentTypeConnection({
      producer: { ...adapterPayloadContract, outputTypeId: "task.input.conversation" },
      consumer: jsonPayloadEncoderTypeContract,
    }),
  ).toThrowError(expect.objectContaining({ code: "invalid_component_type_contract" }));

  expect(() =>
    validateComponentTypeConnection({
      producer: {
        ...adapterPayloadContract,
        outputMediaTypes: [{ type: "text", subtype: "plain", parameters: {} }],
      },
      consumer: jsonPayloadEncoderTypeContract,
    }),
  ).toThrowError(expect.objectContaining({ code: "invalid_component_type_contract" }));

  expect(() =>
    validateComponentTypeConnection({
      producer: {
        outputTypeId: adapterPayloadContract.outputTypeId,
        outputSchemaId: adapterPayloadContract.outputSchemaId,
      },
      consumer: jsonPayloadEncoderTypeContract,
    }),
  ).toThrowError(expect.objectContaining({ code: "invalid_component_type_contract" }));
});
