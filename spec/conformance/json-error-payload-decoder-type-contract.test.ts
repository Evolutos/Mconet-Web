// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type { ComponentTypeContract } from "../../packages/core-spi/src/component-type-contract.js";
import { validateComponentTypeConnection } from "../../packages/core-runtime/src/validate-component-type-connection.js";
import { jsonErrorPayloadDecoderTypeContract } from "../../packages/codec-json/src/json-error-payload-decoder-descriptor.js";

/** Downstream port that accepts a schema-free JSON error payload. */
const errorPayloadConsumer: ComponentTypeContract = {
  inputTypeId: "json.value",
  inputMediaTypes: [{ type: "application", subtype: "json", parameters: {} }],
};

it("connects a decoded error payload to a JSON consumer", () => {
  expect(() =>
    validateComponentTypeConnection({
      producer: jsonErrorPayloadDecoderTypeContract,
      consumer: errorPayloadConsumer,
    }),
  ).not.toThrow();
});

it("rejects a consumer that requires another type or a protocol schema", () => {
  expect(() =>
    validateComponentTypeConnection({
      producer: jsonErrorPayloadDecoderTypeContract,
      consumer: { ...errorPayloadConsumer, inputTypeId: "task.output.error" },
    }),
  ).toThrowError(expect.objectContaining({ code: "invalid_component_type_contract" }));

  expect(() =>
    validateComponentTypeConnection({
      producer: jsonErrorPayloadDecoderTypeContract,
      consumer: {
        ...errorPayloadConsumer,
        inputSchemaId: "schema://example/error",
      },
    }),
  ).toThrowError(expect.objectContaining({ code: "invalid_component_type_contract" }));
});
