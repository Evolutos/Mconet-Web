// Copyright © 2026 Mcont.

import type {
  Diagnostic,
  ModelOutput,
  ModelRequest,
  ParsedTaskResponse,
} from "@evolutos/mconet-core-domain";

/**
 * Runtime-only factory that assembles one public model output.
 *
 * Protocol adapters own only ParsedTaskResponse. This factory restores the
 * originating request target, attaches Runtime diagnostics and an optional
 * Runtime-assigned output identity, and copies parsed facts without inference.
 * Inputs are expected to have passed their dedicated domain validators before
 * this terminal Runtime stage; assembly does not repeat structural validation.
 * The object is not exported from the core-runtime package entry, preventing
 * public consumers and adapter packages from bypassing Runtime ownership.
 */
export const ModelOutputAssembler = Object.freeze({
  assemble: assembleModelOutput,
});

/**
 * Assembles one immutable outer ModelOutput from its three factual owners.
 *
 * @param input Originating request, parsed service facts, Runtime diagnostics,
 * and an optional Runtime identity.
 * @returns A new frozen output that retains every nested source by identity.
 */
function assembleModelOutput(input: {
  readonly request: ModelRequest;
  readonly response: ParsedTaskResponse;
  readonly diagnostics: readonly Diagnostic[];
  readonly outputId?: string;
}): ModelOutput {
  const { request, response, diagnostics, outputId } = input;

  // Conditional spreads preserve true absence. In particular, the requested
  // target model never becomes resolvedModel when the service omitted it.
  const output: ModelOutput = {
    ...(outputId === undefined ? {} : { id: outputId }),
    target: request.target,
    ...(response.resolvedModel === undefined ? {} : { resolvedModel: response.resolvedModel }),
    status: response.status,
    result: response.result,
    ...(response.stopReason === undefined ? {} : { stopReason: response.stopReason }),
    ...(response.usage === undefined ? {} : { usage: response.usage }),
    diagnostics,
    protocolState: response.protocolState,
    extensions: response.extensions,
  };

  // Freeze only the newly owned envelope. Nested immutable contracts keep
  // their original identities and remain under their existing owners.
  return Object.freeze(output);
}
