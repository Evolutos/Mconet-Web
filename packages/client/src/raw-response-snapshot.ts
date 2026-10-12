// Copyright © 2026 Mcont.

import type { TransportResponseMetadata } from "@evolutos/mconet-core-spi";

/**
 * Opt-in copy of one transport response.
 *
 * Bytes and metadata are readonly so a caller cannot replace the captured
 * evidence. The type does not capture a response, apply a size limit, or
 * redact secrets. Those behaviors are separate steps, and the snapshot stays
 * absent unless a call asks for it.
 */
export interface RawResponseSnapshot {
  /** Buffered response bytes retained for the caller that opted in. */
  readonly bytes: Uint8Array;

  /** Response facts that accompany the bytes. Header values may still hold secrets until redaction. */
  readonly metadata: TransportResponseMetadata;
}
