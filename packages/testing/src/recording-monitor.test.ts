// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { InteractionMonitor, MonitoringEvent } from "@evolutos/mconet-core-spi";

import { RecordingMonitor } from "./recording-monitor.js";

/** Stable metadata shared by recording monitor fixtures. */
const descriptor: InteractionMonitor["descriptor"] = {
  name: "recording-monitor",
  version: "1.0.0",
  capabilities: new Set(),
  source: "application",
};

/** First bounded and redacted event supplied by a publisher. */
const firstEvent: MonitoringEvent = {
  id: "event-first",
  type: "interaction.did_start",
  interactionId: "interaction-test",
  timestamp: { epochMilliseconds: 2_000_000_000_000 },
  payload: { phase: "started" },
  metadata: { environment: "test" },
};

/** Second distinct event used to verify publication order. */
const secondEvent: MonitoringEvent = {
  id: "event-second",
  type: "transport.did_receive_response",
  interactionId: "interaction-test",
  traceId: "trace-test",
  timestamp: { epochMilliseconds: 2_000_000_000_100 },
  payload: { statusCode: 200, byteCount: 2 },
  metadata: {},
};

it("records sanitized event identities in publication order", async () => {
  const monitor = new RecordingMonitor({ descriptor });

  expect(monitor.snapshotEvents()).toEqual([]);
  await expect(monitor.onEvent(firstEvent)).resolves.toBeUndefined();
  await expect(monitor.onEvent(secondEvent)).resolves.toBeUndefined();
  await expect(monitor.onEvent(firstEvent)).resolves.toBeUndefined();

  expect(monitor.descriptor).toBe(descriptor);
  expect(monitor.snapshotEvents()).toEqual([firstEvent, secondEvent, firstEvent]);
  expect(monitor.snapshotEvents()[0]).toBe(firstEvent);
  expect(monitor.snapshotEvents()[1]).toBe(secondEvent);
  expect(monitor.snapshotEvents()[2]).toBe(firstEvent);
});

it("preserves an omitted filter as interest in every published event", () => {
  const monitor = new RecordingMonitor({ descriptor });

  // Property omission, rather than an allocated empty set, preserves the SPI's
  // explicit all-events convention for the monitoring publisher.
  expect(Object.hasOwn(monitor, "observedEvents")).toBe(false);
  expect(monitor.observedEvents).toBeUndefined();
});

it("preserves the configured read-only event filter identity", () => {
  const observedEvents = new Set([firstEvent.type, secondEvent.type]);
  const monitor = new RecordingMonitor({ descriptor, observedEvents });

  // Filtering belongs to the publisher; the recorder only exposes the exact
  // configured interest set through the production SPI.
  expect(monitor.observedEvents).toBe(observedEvents);
});

it("returns frozen snapshots detached from later publications", async () => {
  const monitor = new RecordingMonitor({ descriptor });
  await monitor.onEvent(firstEvent);
  const firstSnapshot = monitor.snapshotEvents();

  await monitor.onEvent(secondEvent);
  const secondSnapshot = monitor.snapshotEvents();

  expect(firstSnapshot).toEqual([firstEvent]);
  expect(secondSnapshot).toEqual([firstEvent, secondEvent]);
  expect(firstSnapshot).not.toBe(secondSnapshot);
  expect(Object.isFrozen(firstSnapshot)).toBe(true);
  expect(Reflect.set(firstSnapshot, 0, secondEvent)).toBe(false);
});

it("implements only monitoring plus read-only event observation", () => {
  expectTypeOf<RecordingMonitor>().toMatchTypeOf<InteractionMonitor>();
  expectTypeOf<RecordingMonitor["onEvent"]>().toEqualTypeOf<InteractionMonitor["onEvent"]>();
  expectTypeOf<RecordingMonitor>().not.toHaveProperty("request");
  expectTypeOf<RecordingMonitor>().not.toHaveProperty("response");
  expectTypeOf<RecordingMonitor>().not.toHaveProperty("publish");
  expectTypeOf<RecordingMonitor>().not.toHaveProperty("events");
  expectTypeOf<RecordingMonitor>().not.toHaveProperty("reset");
});
