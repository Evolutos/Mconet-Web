// Copyright © 2026 Mcont.

import type { JsonValue } from "@evolutos/mconet-core-domain";
import type { InteractionMonitor, MonitoringEvent } from "@evolutos/mconet-core-spi";

import type { SafePreAuthorizationRequestSnapshot } from "./safe-pre-authorization-request-snapshot.js";

/** Event name for the redacted request summary published before authorization. */
const preAuthorizationEventType = "interaction.request.pre_authorization";

/**
 * Publishes one read-only pre-authorization event.
 *
 * Each interested monitor receives the same frozen event. The payload is the
 * JSON form of the safe snapshot, so the monitor cannot see the body, query
 * values, or an authorization header that the snapshot already dropped. A
 * monitor's return value is ignored. This stage does not apply authorization.
 *
 * @param input Monitors, the safe snapshot, and correlation identifiers.
 */
export async function schedulePreAuthorizationEvent(input: {
  readonly monitors: readonly InteractionMonitor[];
  readonly snapshot: SafePreAuthorizationRequestSnapshot;
  readonly interactionId: string;
  readonly traceId?: string;
  readonly timestampEpochMilliseconds?: number;
}): Promise<void> {
  const event = createEvent(input);

  for (const monitor of input.monitors) {
    if (
      monitor.observedEvents !== undefined &&
      !monitor.observedEvents.has(preAuthorizationEventType)
    ) {
      // A declared filter that excludes this event is not an error.
      continue;
    }
    // The event is frozen. A monitor cannot replace its payload or add a field.
    await monitor.onEvent(event);
  }
}

/**
 * Builds the frozen event for one snapshot.
 *
 * @param input Snapshot and correlation values supplied by the caller.
 * @returns A frozen monitoring event whose payload contains no body bytes.
 */
function createEvent(input: {
  readonly snapshot: SafePreAuthorizationRequestSnapshot;
  readonly interactionId: string;
  readonly traceId?: string;
  readonly timestampEpochMilliseconds?: number;
}): MonitoringEvent {
  const headers = Object.freeze(
    input.snapshot.headers.map((header) =>
      Object.freeze({ name: header.name, value: header.value }),
    ),
  );
  const payload: JsonValue = Object.freeze({
    method: input.snapshot.method,
    url: Object.freeze({ kind: input.snapshot.url.kind, value: input.snapshot.url.value }),
    headers,
    queryCount: input.snapshot.queryCount,
    bodyByteLength: input.snapshot.bodyByteLength,
  });

  return Object.freeze({
    id: `${input.interactionId}:${preAuthorizationEventType}`,
    type: preAuthorizationEventType,
    interactionId: input.interactionId,
    ...(input.traceId === undefined ? {} : { traceId: input.traceId }),
    timestamp: Object.freeze({
      epochMilliseconds: input.timestampEpochMilliseconds ?? Date.now(),
    }),
    payload,
    metadata: Object.freeze({}),
  });
}
