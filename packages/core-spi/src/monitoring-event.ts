// Copyright © 2026 Mcont.

import type {
  Extensions,
  JsonValue,
  OpenIdentifier,
  Timestamp,
} from "@evolutos/mconet-core-domain";

/**
 * Immutable, portable observation emitted during one model interaction.
 *
 * Identifiers and the timestamp provide event correlation without exposing an
 * executable monitor, request, response, or runtime component. Payload and
 * metadata admit only the shared JSON-compatible value model, excluding secret
 * wrappers, raw bytes, errors, and arbitrary provider objects from this public
 * structural boundary. Event producers must still redact sensitive strings and
 * apply configured body limits before constructing an event because static JSON
 * compatibility alone cannot identify confidential business data.
 */
export interface MonitoringEvent {
  /** Producer-assigned identity used to deduplicate one observation. */
  readonly id: string;

  /** Open standard or integration-defined event name. */
  readonly type: OpenIdentifier;

  /** Identity of the interaction that emitted this event. */
  readonly interactionId: string;

  /** Optional external trace identity used to correlate monitoring backends. */
  readonly traceId?: string;

  /** Portable UTC instant at which the observed event occurred. */
  readonly timestamp: Timestamp;

  /** Event-specific JSON facts that have already been bounded and redacted. */
  readonly payload: JsonValue;

  /** Read-only JSON metadata used for portable monitoring correlation. */
  readonly metadata: Extensions;
}
