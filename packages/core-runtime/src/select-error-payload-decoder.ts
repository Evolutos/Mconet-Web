// Copyright © 2026 Mcont.

import type {
  ComponentRole,
  DecoderSelection,
  PayloadDecoder,
  RuntimeComponent,
} from "@evolutos/mconet-core-spi";

import { selectPayloadDecoder } from "./select-payload-decoder.js";

/** Stable execution-chain role used by error Decoder diagnostics. */
const errorPayloadDecoderRole: ComponentRole = Object.freeze({
  id: "codec.response.error-decoder",
});

/**
 * Selects and validates the payload Decoder fixed for service-error responses.
 *
 * Error criteria and candidates remain independent from the success path so a
 * transport outcome later chooses only between two already fixed instances.
 * Interaction and Client instances are final choices; Integration candidates
 * share one tier, followed only when necessary by the SDK error Decoder default.
 *
 * @param input Planned error criteria and candidates from every priority tier.
 * @returns The original uniquely selected error Decoder instance.
 * @throws {ModelInteractionError} When candidates are malformed, incompatible,
 * absent, or ambiguous at the active priority tier.
 */
export function selectErrorPayloadDecoder(
  input: Readonly<{
    readonly selection: DecoderSelection;
    readonly interactionDecoder?: PayloadDecoder;
    readonly clientDecoder?: PayloadDecoder;
    readonly integrationDecoders: readonly RuntimeComponent[];
    readonly sdkDefaultDecoder?: PayloadDecoder;
  }>,
): PayloadDecoder {
  // Fix the error role here so failures identify the independent response path;
  // neither success criteria nor a previously selected success instance is read.
  return selectPayloadDecoder({
    role: errorPayloadDecoderRole,
    selection: input.selection,
    interactionDecoder: input.interactionDecoder,
    clientDecoder: input.clientDecoder,
    integrationDecoders: input.integrationDecoders,
    sdkDefaultDecoder: input.sdkDefaultDecoder,
  });
}
