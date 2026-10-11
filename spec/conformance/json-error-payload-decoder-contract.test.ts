// Copyright © 2026 Mcont.

import { ModelInteractionError } from "../../packages/core-domain/src/index.js";
import { JsonErrorPayloadDecoder } from "../../packages/codec-json/src/json-error-payload-decoder.js";
import type { CodecContext } from "../../packages/core-spi/src/index.js";
import { definePayloadDecoderContract } from "../../packages/testing/src/payload-decoder-contract.js";

/** Limit shared by the success, invalid, and oversized decoder instances. */
const maximumBodyBytes = 48;

/** Well-formed provider error document. */
const successText = '{"code":"rate_limit","message":"slow down"}';

/**
 * Malformed error document that remains inside the byte limit.
 *
 * The marker stays in the body so a failure that copied the body cannot match
 * the content-free expected error.
 */
const invalidText = '{"secret":"malformed-error-body"';

/** Error document whose UTF-8 length is past the shared limit. */
const oversizedText = `{"secret":"${"provider-error-body".repeat(4)}"}`;

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

/** Registers the shared decoder contract against the JSON error decoder. */
definePayloadDecoderContract("JsonErrorPayloadDecoder", () => {
  return {
    maxInputBytes: maximumBodyBytes,
    decoder: new JsonErrorPayloadDecoder(maximumBodyBytes),
    success: {
      bytes: jsonBytes(successText),
      context: decodingContext(),
      expected: {
        typeId: "json.value",
        value: { code: "rate_limit", message: "slow down" },
      },
    },
    invalidPayloadDecoder: new JsonErrorPayloadDecoder(maximumBodyBytes),
    invalidPayload: {
      bytes: jsonBytes(invalidText),
      context: decodingContext(),
      expected: invalidJsonError(),
    },
    oversizedPayloadDecoder: new JsonErrorPayloadDecoder(maximumBodyBytes),
    oversizedPayload: {
      bytes: jsonBytes(oversizedText),
      context: decodingContext(),
      expected: oversizedBodyError(),
    },
  };
});
