// Copyright © 2026 Mcont.

/**
 * Public module boundary for the Mconet JSON codec.
 *
 * The JSON payload type is available before encoding and decoding behavior so
 * protocol adapters can align their erased values without importing an
 * implementation, runtime validator, Schema library, or wire-format component.
 */
export type { JsonPayload } from "./json-payload.js";
