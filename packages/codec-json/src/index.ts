// Copyright © 2026 Mcont.

/**
 * Public module boundary for the Mconet JSON codec.
 *
 * The payload contract and request encoder are published together. This entry
 * does not export a response decoder, media-type matcher, or port-metadata
 * helper, and the encoder does not register itself.
 */
export { JsonPayloadEncoder } from "./json-payload-encoder.js";
export type { JsonPayload } from "./json-payload.js";
