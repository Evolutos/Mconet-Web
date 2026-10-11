// Copyright © 2026 Mcont.

/**
 * Public module boundary for the Mconet JSON codec.
 *
 * The payload contract, JSON codec components, encoder descriptor, and JSON
 * media-type matcher are published together. This entry does not export a port
 * contract helper, and none of the components register themselves.
 */
export { JsonErrorPayloadDecoder } from "./json-error-payload-decoder.js";
export { jsonPayloadEncoderDescriptor } from "./json-payload-encoder-descriptor.js";
export { JsonPayloadEncoder } from "./json-payload-encoder.js";
export { JsonSuccessPayloadDecoder } from "./json-success-payload-decoder.js";
export { isJsonMediaType } from "./is-json-media-type.js";
export type { JsonPayload } from "./json-payload.js";
