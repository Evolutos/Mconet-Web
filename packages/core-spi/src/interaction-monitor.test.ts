// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

import type { InteractionMonitor } from "./interaction-monitor.js";
import type { MonitoringEvent } from "./monitoring-event.js";
import type { RuntimeComponent } from "./runtime-component.js";

it("defines the exact asynchronous read-only observation boundary", () => {
  // RuntimeComponent supplies immutable descriptive metadata. Exact property and
  // method types prevent requests, responses, continuations, or return values
  // from expanding the monitor's observation-only authority.
  expectTypeOf<InteractionMonitor>().toMatchTypeOf<RuntimeComponent>();
  expectTypeOf<InteractionMonitor["observedEvents"]>().toEqualTypeOf<
    ReadonlySet<OpenIdentifier> | undefined
  >();
  expectTypeOf<InteractionMonitor["onEvent"]>().toEqualTypeOf<
    (event: MonitoringEvent) => Promise<void>
  >();
});

it("forwards the immutable event snapshot without replacing its identity", async () => {
  const event: MonitoringEvent = {
    id: "event-1",
    type: "transport.did_receive_response",
    interactionId: "interaction-1",
    timestamp: { epochMilliseconds: 1_791_322_800_123 },
    payload: { status: "completed", byteCount: 512 },
    metadata: { region: "test-region" },
  };
  const onEvent = vi.fn(async (receivedEvent: MonitoringEvent): Promise<void> => {
    // Identity comparison demonstrates observation of the published snapshot;
    // the fixture performs no mutation, request access, or interaction control.
    expect(receivedEvent).toBe(event);
  });
  const monitor: InteractionMonitor = {
    descriptor: {
      name: "test-interaction-monitor",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    observedEvents: new Set(["transport.did_receive_response"]),
    onEvent,
  };

  await expect(monitor.onEvent(event)).resolves.toBeUndefined();
  expect(onEvent).toHaveBeenCalledOnce();
  expect(onEvent).toHaveBeenCalledWith(event);
});

it("uses an omitted filter to represent interest in all published events", () => {
  const monitor: InteractionMonitor = {
    descriptor: {
      name: "all-events-monitor",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    async onEvent() {
      // This no-op fixture proves that a filter is not required; actual event
      // dispatch and failure isolation are responsibilities of the publisher.
    },
  };

  // The SPI does not allocate a default set or enumerate standard event names.
  expect(Object.hasOwn(monitor, "observedEvents")).toBe(false);
  expect(monitor.observedEvents).toBeUndefined();
});

it("allows monitor failures to reject for later publisher isolation", async () => {
  const monitorFailure = new Error("monitor backend unavailable");
  const monitor: InteractionMonitor = {
    descriptor: {
      name: "failing-interaction-monitor",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    onEvent() {
      // The interface preserves the implementation failure. A later monitoring
      // publisher catches it so observation cannot replace the interaction result.
      return Promise.reject(monitorFailure);
    },
  };
  const event: MonitoringEvent = {
    id: "event-2",
    type: "interaction.failed",
    interactionId: "interaction-2",
    timestamp: { epochMilliseconds: 1_791_322_800_456 },
    payload: { code: "transport_failure" },
    metadata: {},
  };

  await expect(monitor.onEvent(event)).rejects.toBe(monitorFailure);
});

it("prevents mutation of the event filter through the public contract", () => {
  const proveReadonly = (
    monitor: InteractionMonitor,
    replacement: ReadonlySet<OpenIdentifier>,
  ): void => {
    // This helper remains compile-only so strict TypeScript checks both the
    // property reference and collection surface without mutating a live monitor.
    // @ts-expect-error The declared event filter cannot be replaced.
    monitor.observedEvents = replacement;
    // @ts-expect-error ReadonlySet does not expose event filter mutation.
    monitor.observedEvents?.add("replacement.event");
  };

  expectTypeOf(proveReadonly).toBeFunction();
});

it("does not expose request mutation transport or pipeline control", () => {
  // Neighboring stages and the publisher retain their own narrow responsibilities.
  expectTypeOf<InteractionMonitor>().not.toHaveProperty("request");
  expectTypeOf<InteractionMonitor>().not.toHaveProperty("response");
  expectTypeOf<InteractionMonitor>().not.toHaveProperty("next");
  expectTypeOf<InteractionMonitor>().not.toHaveProperty("send");
  expectTypeOf<InteractionMonitor>().not.toHaveProperty("apply");
  expectTypeOf<InteractionMonitor>().not.toHaveProperty("publish");
});
