// Copyright © 2026 Mcont.

import type { Bytes } from "@evolutos/mconet-core-domain";

import type { TransportResponseMetadata } from "./transport-response-metadata.js";

/**
 * One complete buffered response returned by a unary byte transport.
 *
 * Metadata remains available without inspecting the body, while the body keeps
 * the exact byte view supplied by the transport for the already selected
 * decoder. Readonly fields prevent reference replacement but deliberately make
 * no deep-immutability, ownership, copying, parsing, or resource-release claim
 * about the caller-owned Uint8Array storage.
 */
export interface TransportResponse {
  /** Protocol-neutral response classification and native response observations. */
  readonly metadata: TransportResponseMetadata;

  /** Buffered response bytes retained without decoding or copying. */
  readonly body: Bytes;
}
