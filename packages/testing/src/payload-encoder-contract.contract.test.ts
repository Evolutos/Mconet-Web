// Copyright © 2026 Mcont.

import type { CodecContext, ErasedRuntimeValue, TransportBody } from "@evolutos/mconet-core-spi";

import { definePayloadEncoderContract } from "./payload-encoder-contract.js";
import { StubPayloadEncoder } from "./stub-payload-encoder.js";

/** Registers the shared suite against deterministic success and failure encoders. */
definePayloadEncoderContract("StubPayloadEncoder", () => {
  // Fresh values and signals isolate mutation checks between the two contract
  // cases while preserving realistic erased payload and lifecycle boundaries.
  const successValue: ErasedRuntimeValue = {
    typeId: "protocol.contract.request",
    schemaId: "schema://protocol.contract/request/1",
    value: { messages: [] },
  };
  const failureValue: ErasedRuntimeValue = {
    typeId: "protocol.contract.invalid-request",
    value: { unsupported: true },
  };
  const successContext: CodecContext = {
    signal: new AbortController().signal,
  };
  const failureContext: CodecContext = {
    signal: new AbortController().signal,
  };
  const body: TransportBody = {
    kind: "bytes",
    bytes: new Uint8Array([0x7b, 0x7d]),
  };
  const failure = new TypeError("contract payload cannot be encoded");
  const descriptor = {
    name: "contract-payload-encoder",
    version: "1.0.0",
    capabilities: new Set<string>(),
    source: "application" as const,
  };
  const encoder = new StubPayloadEncoder({
    descriptor,
    encode: () => Promise.resolve(body),
  });
  const failingEncoder = new StubPayloadEncoder({
    descriptor,
    encode: () => Promise.reject(failure),
  });

  // The suite owns all assertions; this factory supplies only implementation
  // instances, inputs, and externally visible expected outcomes.
  return {
    encoder,
    success: { value: successValue, context: successContext, expected: body },
    failingEncoder,
    failure: { value: failureValue, context: failureContext, expected: failure },
  };
});
