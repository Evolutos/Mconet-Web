// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type { ComponentTypeContract } from "../../packages/core-spi/src/component-type-contract.js";
import { validateComponentTypeConnection } from "../../packages/core-runtime/src/validate-component-type-connection.js";
import { jsonSuccessPayloadDecoderTypeContract } from "../../packages/codec-json/src/json-success-payload-decoder-descriptor.js";

/** Downstream port that accepts a schema-free JSON success payload. */
const successPayloadConsumer: ComponentTypeContract = {
  inputTypeId: "json.value",
  inputMediaTypes: [{ type: "application", subtype: "json", parameters: {} }],
};

it("connects a decoded success payload to a JSON consumer", () => {
  expect(() =>
    validateComponentTypeConnection({
      producer: jsonSuccessPayloadDecoderTypeContract,
      consumer: successPayloadConsumer,
    }),
  ).not.toThrow();
});

it("rejects a consumer that requires another type or a protocol schema", () => {
  expect(() =>
    validateComponentTypeConnection({
      producer: jsonSuccessPayloadDecoderTypeContract,
      consumer: { ...successPayloadConsumer, inputTypeId: "task.output.conversation" },
    }),
  ).toThrowError(expect.objectContaining({ code: "invalid_component_type_contract" }));

  expect(() =>
    validateComponentTypeConnection({
      producer: jsonSuccessPayloadDecoderTypeContract,
      consumer: {
        ...successPayloadConsumer,
        inputSchemaId: "schema://example/response",
      },
    }),
  ).toThrowError(expect.objectContaining({ code: "invalid_component_type_contract" }));
});
