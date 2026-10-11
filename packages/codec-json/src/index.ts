// Copyright © 2026 Mcont.

/**
 * Public module boundary for the Mconet JSON codec.
 *
 * The payload contract, request encoder, and success decoder are published
 * together. This entry does not export an error decoder, media-type matcher,
 * or port-metadata helper, and neither component registers itself.
 */
export { JsonPayloadEncoder } from "./json-payload-encoder.js";
export { JsonSuccessPayloadDecoder } from "./json-success-payload-decoder.js";
export type { JsonPayload } from "./json-payload.js";
