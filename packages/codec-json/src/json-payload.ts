// Copyright © 2026 Mcont.

import type { JsonValue, OpenIdentifier } from "@evolutos/mconet-core-domain";

/**
 * Erased protocol payload whose representation is guaranteed to be JSON data.
 *
 * Type and optional Schema identities retain the semantic port facts produced
 * by a protocol adapter, while the narrowed value excludes bytes, class
 * instances, functions, bigint, undefined, and other non-JSON representations.
 * Runtime validation remains required at untrusted boundaries; this interface
 * contains no validator, codec behavior, media type, component selection, or
 * transport state.
 */
export interface JsonPayload {
  /** Semantic identity preserved from the protocol adapter output port. */
  readonly typeId: OpenIdentifier;

  /** Optional Schema identity preserved from the protocol adapter output port. */
  readonly schemaId?: string;

  /** Immutable JSON-compatible value carried through the erased SPI envelope. */
  readonly value: JsonValue;
}
