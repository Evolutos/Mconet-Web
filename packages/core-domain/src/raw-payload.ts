// Copyright © 2026 Mcont.

import type { Bytes } from "./bytes.js";
import type { JsonValue } from "./json-value.js";

/**
 * Bounded raw payload retained when a typed representation is unavailable.
 *
 * The optional media type and schema identifier preserve wire metadata without
 * claiming that either string has already been parsed. `truncated` must state
 * whether the bytes are incomplete. The byte view itself follows the shared
 * {@link Bytes} ownership contract and is not made deeply immutable by this
 * interface.
 */
export interface RawPayload {
  /** Original media type string, when one was available. */
  readonly mediaType?: string;

  /** Schema identifier associated with the bytes, when one was available. */
  readonly schemaId?: string;

  /** Retained payload bytes, potentially limited by a boundary policy. */
  readonly bytes: Bytes;

  /** Whether the retained bytes omit any part of the original payload. */
  readonly truncated: boolean;

  /** JSON-compatible metadata that does not duplicate executable behavior. */
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

/**
 * Determines whether retained raw payload bytes satisfy a positive size limit.
 *
 * The limit applies to the visible {@link Bytes} view, not its backing buffer.
 * A truncated payload remains valid when its retained bytes fit the limit;
 * truncation records source completeness and never exempts bytes from the cap.
 * Invalid limits return `false` instead of weakening the resource boundary.
 *
 * @param payload Raw payload whose retained bytes are measured.
 * @param maxBytes Maximum permitted retained bytes as a positive safe integer.
 * @returns Whether the limit is valid and the retained bytes do not exceed it.
 */
export function isRawPayloadWithinSizeLimit(payload: RawPayload, maxBytes: number): boolean {
  // Resource limits must be exact, positive JSON-safe integers so every
  // supported runtime applies the same finite boundary.
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    return false;
  }

  // byteLength measures only the supplied Uint8Array view. The truncated flag
  // describes omitted source data and therefore does not alter this comparison.
  return payload.bytes.byteLength <= maxBytes;
}
