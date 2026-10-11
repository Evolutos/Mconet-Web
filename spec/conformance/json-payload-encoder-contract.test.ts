// Copyright © 2026 Mcont.

import { ModelInteractionError } from "../../packages/core-domain/src/index.js";
import { JsonPayloadEncoder } from "../../packages/codec-json/src/json-payload-encoder.js";
import type { CodecContext, ErasedRuntimeValue } from "../../packages/core-spi/src/index.js";
import { definePayloadEncoderContract } from "../../packages/testing/src/payload-encoder-contract.js";

/** Canonical JSON text for the successful encoder fixture. Schema identity is absent. */
const encodedObjectText = '{"b":1,"a":null}';

/** Registers the shared encoder contract against the real JSON payload encoder. */
definePayloadEncoderContract("JsonPayloadEncoder", () => {
  const successValue: ErasedRuntimeValue = {
    typeId: "json.value",
    schemaId: "schema://json.contract/object/1",
    value: { b: 1, a: null },
  };
  const failureValue: ErasedRuntimeValue = {
    typeId: "json.value",
    value: Number.NaN,
  };
  const successContext: CodecContext = { signal: new AbortController().signal };
  const failureContext: CodecContext = { signal: new AbortController().signal };

  return {
    encoder: new JsonPayloadEncoder(),
    success: {
      value: successValue,
      context: successContext,
      expected: {
        kind: "bytes",
        bytes: new TextEncoder().encode(encodedObjectText),
      },
    },
    failingEncoder: new JsonPayloadEncoder(),
    failure: {
      value: failureValue,
      context: failureContext,
      expected: new ModelInteractionError({
        message: "JSON payload cannot be serialized.",
        category: "serialization",
        phase: "encoding",
        code: "serialization",
        diagnostics: [],
      }),
    },
  };
});
