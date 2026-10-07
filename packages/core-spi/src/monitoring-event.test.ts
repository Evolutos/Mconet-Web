// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type {
  Extensions,
  JsonValue,
  OpenIdentifier,
  SecretValue,
  Timestamp,
} from "@evolutos/mconet-core-domain";

import type { MonitoringEvent } from "./monitoring-event.js";

it("defines only immutable portable monitoring facts", () => {
  // Exact equality prevents requests, responses, component instances, monitor
  // callbacks, mutable error objects, or implicit capture settings from entering
  // the event contract.
  expectTypeOf<MonitoringEvent>().toEqualTypeOf<{
    readonly id: string;
    readonly type: OpenIdentifier;
    readonly interactionId: string;
    readonly traceId?: string;
    readonly timestamp: Timestamp;
    readonly payload: JsonValue;
    readonly metadata: Extensions;
  }>();
});

it("preserves redacted payload and metadata without normalization", () => {
  const timestamp: Timestamp = { epochMilliseconds: 1_791_322_800_123 };
  const payload = {
    phase: "transport",
    durationMilliseconds: 37,
    byteCount: 512,
    status: "completed",
  } as const satisfies JsonValue;
  const metadata = {
    region: "test-region",
    retryCount: 0,
  } as const satisfies Extensions;
  const event: MonitoringEvent = {
    id: "event-1",
    type: "transport.did_receive_response",
    interactionId: "interaction-1",
    traceId: "trace-1",
    timestamp,
    payload,
    metadata,
  };

  // This data-only contract retains already-sanitized values and their identity;
  // event creation, copying, runtime JSON validation, and publication belong to
  // later runtime boundaries.
  expect(event.timestamp).toBe(timestamp);
  expect(event.payload).toBe(payload);
  expect(event.metadata).toBe(metadata);
  expect(event).toMatchObject({
    id: "event-1",
    type: "transport.did_receive_response",
    interactionId: "interaction-1",
    traceId: "trace-1",
  });
});

it("allows events without an external trace identity", () => {
  const event: MonitoringEvent = {
    id: "event-2",
    type: "interaction.started",
    interactionId: "interaction-2",
    timestamp: { epochMilliseconds: 1_791_322_800_456 },
    payload: null,
    metadata: {},
  };

  // Trace correlation is optional; its absence must not create an empty or
  // generated trace identity at this structural contract layer.
  expect(Object.hasOwn(event, "traceId")).toBe(false);
  expect(event.traceId).toBeUndefined();
});

it("excludes secret wrappers and non-JSON runtime values", () => {
  // Protected secrets, bytes, and Error instances cannot occupy either JSON
  // boundary. Redacting sensitive ordinary strings remains the producer's duty.
  expectTypeOf<SecretValue>().not.toMatchTypeOf<MonitoringEvent["payload"]>();
  expectTypeOf<Uint8Array>().not.toMatchTypeOf<MonitoringEvent["payload"]>();
  expectTypeOf<Error>().not.toMatchTypeOf<MonitoringEvent["payload"]>();
  expectTypeOf<{ readonly secret: SecretValue }>().not.toMatchTypeOf<MonitoringEvent["metadata"]>();
});

it("prevents replacing event fields through the public contract", () => {
  const proveReadonly = (event: MonitoringEvent): void => {
    // The helper remains compile-only so strict TypeScript verifies every field
    // without mutating a runtime fixture or relying on Object.freeze behavior.
    // @ts-expect-error Event identity is immutable.
    event.id = "replacement";
    // @ts-expect-error Event type is immutable.
    event.type = "replacement.event";
    // @ts-expect-error Interaction correlation is immutable.
    event.interactionId = "replacement";
    // @ts-expect-error Trace correlation is immutable when present.
    event.traceId = "replacement";
    // @ts-expect-error Event time is immutable.
    event.timestamp = { epochMilliseconds: 0 };
    // @ts-expect-error Event payload cannot be replaced.
    event.payload = null;
    // @ts-expect-error Event metadata cannot be replaced.
    event.metadata = {};
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
