// Copyright © 2026 Mcont.

import type {
  ComponentRole,
  DecoderSelection,
  PayloadDecoder,
  RuntimeComponent,
} from "@evolutos/mconet-core-spi";

import { selectPayloadDecoder } from "./select-payload-decoder.js";

/** Stable execution-chain role used by success Decoder diagnostics. */
const successPayloadDecoderRole: ComponentRole = Object.freeze({
  id: "codec.response.success-decoder",
});

/**
 * Selects and validates the payload Decoder fixed for successful responses.
 *
 * Interaction and Client instances are final choices. Integration candidates
 * share one tier, and the SDK default is considered only when no direct instance
 * exists and no integration candidate matches. The package-internal deterministic
 * algorithm validates planned input media type and output Schema before I/O.
 *
 * @param input Planned success criteria and candidates from every priority tier.
 * @returns The original uniquely selected success Decoder instance.
 * @throws {ModelInteractionError} When candidates are malformed, incompatible,
 * absent, or ambiguous at the active priority tier.
 */
export function selectSuccessPayloadDecoder(
  input: Readonly<{
    readonly selection: DecoderSelection;
    readonly interactionDecoder?: PayloadDecoder;
    readonly clientDecoder?: PayloadDecoder;
    readonly integrationDecoders: readonly RuntimeComponent[];
    readonly sdkDefaultDecoder?: PayloadDecoder;
  }>,
): PayloadDecoder {
  // Fix the success role here so callers cannot substitute an error or arbitrary
  // diagnostic role while reusing the shared non-injectable selection invariant.
  return selectPayloadDecoder({
    role: successPayloadDecoderRole,
    selection: input.selection,
    interactionDecoder: input.interactionDecoder,
    clientDecoder: input.clientDecoder,
    integrationDecoders: input.integrationDecoders,
    sdkDefaultDecoder: input.sdkDefaultDecoder,
  });
}
