// Copyright © 2026 Mcont.

import type { CodecContext, ErasedRuntimeValue, PayloadDecoder } from "@evolutos/mconet-core-spi";

import { definePayloadDecoderContract } from "./payload-decoder-contract.js";
import { StubPayloadDecoder } from "./stub-payload-decoder.js";

/** Registers the shared suite against deterministic decoding outcomes. */
definePayloadDecoderContract("StubPayloadDecoder", () => {
  // Use one small limit and three independent inputs so the suite proves valid,
  // malformed, and oversized behavior without relying on a concrete wire format.
  const maxInputBytes = 4;
  const successBytes = new Uint8Array([0x7b, 0x7d]);
  const invalidPayloadBytes = new Uint8Array([0xff]);
  const oversizedPayloadBytes = new Uint8Array([0x7b, 0x20, 0x20, 0x20, 0x7d]);
  const successContext: CodecContext = {
    signal: new AbortController().signal,
  };
  const invalidPayloadContext: CodecContext = {
    signal: new AbortController().signal,
  };
  const oversizedPayloadContext: CodecContext = {
    signal: new AbortController().signal,
  };
  const decodedValue: ErasedRuntimeValue = {
    typeId: "protocol.contract.response",
    schemaId: "schema://protocol.contract/response/1",
    value: { choices: [] },
  };
  const invalidPayloadError = new SyntaxError("contract payload is invalid");
  const oversizedPayloadError = new RangeError("contract payload exceeds its byte limit");
  const descriptor: PayloadDecoder["descriptor"] = {
    name: "contract-payload-decoder",
    version: "1.0.0",
    capabilities: new Set(),
    source: "application",
  };
  const decoder = new StubPayloadDecoder({
    descriptor,
    decode: () => Promise.resolve(decodedValue),
  });
  const invalidPayloadDecoder = new StubPayloadDecoder({
    descriptor,
    decode: () => Promise.reject(invalidPayloadError),
  });
  const oversizedPayloadDecoder = new StubPayloadDecoder({
    descriptor,
    decode: () => Promise.reject(oversizedPayloadError),
  });

  // The suite owns all assertions; the fixture supplies only decoder instances,
  // byte boundaries, lifecycle contexts, and externally observable outcomes.
  return {
    maxInputBytes,
    decoder,
    success: {
      bytes: successBytes,
      context: successContext,
      expected: decodedValue,
    },
    invalidPayloadDecoder,
    invalidPayload: {
      bytes: invalidPayloadBytes,
      context: invalidPayloadContext,
      expected: invalidPayloadError,
    },
    oversizedPayloadDecoder,
    oversizedPayload: {
      bytes: oversizedPayloadBytes,
      context: oversizedPayloadContext,
      expected: oversizedPayloadError,
    },
  };
});
