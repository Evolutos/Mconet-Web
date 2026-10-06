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
