// Copyright © 2026 Mcont.

/**
 * Public module boundary for the Mconet JSON codec.
 *
 * The payload contract, request encoder, and both JSON decoders are published
 * together. This entry does not export a media-type matcher or port-metadata
 * helper, and none of the components register themselves.
 */
export { JsonErrorPayloadDecoder } from "./json-error-payload-decoder.js";
export { JsonPayloadEncoder } from "./json-payload-encoder.js";
export { JsonSuccessPayloadDecoder } from "./json-success-payload-decoder.js";
export type { JsonPayload } from "./json-payload.js";
