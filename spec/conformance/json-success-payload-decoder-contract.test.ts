// Copyright © 2026 Mcont.

import { ModelInteractionError } from "../../packages/core-domain/src/index.js";
import { JsonSuccessPayloadDecoder } from "../../packages/codec-json/src/json-success-payload-decoder.js";
import type { CodecContext } from "../../packages/core-spi/src/index.js";
import { definePayloadDecoderContract } from "../../packages/testing/src/payload-decoder-contract.js";

/** Limit shared by the success, invalid, and oversized decoder instances. */
const maximumBodyBytes = 32;

/** Well-formed success body. Its schema identity is not part of the JSON text. */
const successText = '{"b":1,"a":null}';

/** Malformed JSON that remains inside the byte limit. */
const invalidText = '{"secret":"malformed-success"';

/** Valid JSON whose UTF-8 length is past the shared limit. */
const oversizedText = `{"secret":"${"x".repeat(maximumBodyBytes)}"}`;

/** UTF-8 bytes for one fixture body. */
function jsonBytes(jsonText: string): Uint8Array {
  return new TextEncoder().encode(jsonText);
}

/** Fresh context so contract cases do not share a signal. */
function decodingContext(): CodecContext {
  return { signal: new AbortController().signal };
}

/** Content-free failure for malformed JSON. */
function invalidJsonError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "JSON response body cannot be decoded.",
    category: "deserialization",
    phase: "decoding",
    code: "deserialization",
    diagnostics: [],
  });
}

/** Content-free failure for a body past the configured limit. */
function oversizedBodyError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Response body exceeds its byte limit.",
    category: "deserialization",
    phase: "decoding",
    code: "response_body_too_large",
    diagnostics: [],
  });
}

/** Registers the shared decoder contract against the JSON success decoder. */
definePayloadDecoderContract("JsonSuccessPayloadDecoder", () => {
  return {
    maxInputBytes: maximumBodyBytes,
    decoder: new JsonSuccessPayloadDecoder(maximumBodyBytes),
    success: {
      bytes: jsonBytes(successText),
      context: decodingContext(),
      expected: {
        typeId: "json.value",
        value: { b: 1, a: null },
      },
    },
    invalidPayloadDecoder: new JsonSuccessPayloadDecoder(maximumBodyBytes),
    invalidPayload: {
      bytes: jsonBytes(invalidText),
      context: decodingContext(),
      expected: invalidJsonError(),
    },
    oversizedPayloadDecoder: new JsonSuccessPayloadDecoder(maximumBodyBytes),
    oversizedPayload: {
      bytes: jsonBytes(oversizedText),
      context: decodingContext(),
      expected: oversizedBodyError(),
    },
  };
});
