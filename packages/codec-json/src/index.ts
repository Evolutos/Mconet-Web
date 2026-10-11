// Copyright © 2026 Mcont.

/**
 * Public module boundary for the Mconet JSON codec.
 *
 * The payload contract, JSON codec components, encoder port metadata, and JSON
 * media-type matcher are published together. None of the components register
 * themselves.
 */
export { JsonErrorPayloadDecoder } from "./json-error-payload-decoder.js";
export {
  jsonErrorPayloadDecoderDescriptor,
  jsonErrorPayloadDecoderTypeContract,
} from "./json-error-payload-decoder-descriptor.js";
export {
  jsonPayloadEncoderCapabilityId,
  jsonPayloadEncoderDescriptor,
  jsonPayloadEncoderTypeContract,
} from "./json-payload-encoder-descriptor.js";
export { JsonPayloadEncoder } from "./json-payload-encoder.js";
export {
  jsonSuccessPayloadDecoderDescriptor,
  jsonSuccessPayloadDecoderTypeContract,
} from "./json-success-payload-decoder-descriptor.js";
export { JsonSuccessPayloadDecoder } from "./json-success-payload-decoder.js";
export { isJsonMediaType } from "./is-json-media-type.js";
export type { JsonPayload } from "./json-payload.js";
