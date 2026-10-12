// Copyright © 2026 Mcont.

import type { InteractionMonitor, MonitoringEvent } from "@evolutos/mconet-core-spi";
import { expect, it, vi } from "vitest";

import { schedulePreAuthorizationEvent } from "./schedule-pre-authorization-event.js";
import type { SafePreAuthorizationRequestSnapshot } from "./safe-pre-authorization-request-snapshot.js";

const secretText = "event-secret-value";

const snapshot: SafePreAuthorizationRequestSnapshot = {
  method: "POST",
  url: { kind: "absolute", value: "https://example.test/v1" },
  headers: [{ name: "content-type", value: "application/json" }],
  queryCount: 1,
  bodyByteLength: 3,
};

function monitor(
  onEvent: InteractionMonitor["onEvent"],
  observedEvents?: ReadonlySet<string>,
): InteractionMonitor {
  return {
    descriptor: {
      name: "monitor",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    ...(observedEvents === undefined ? {} : { observedEvents }),
    onEvent,
  };
}

it("publishes one frozen event and skips a monitor that does not observe it", async () => {
  const seen: MonitoringEvent[] = [];
  const interested = vi.fn(async (event: MonitoringEvent): Promise<void> => {
    seen.push(event);
  });
  const ignored = vi.fn(async (): Promise<void> => {
    throw new Error(secretText);
  });

  await schedulePreAuthorizationEvent({
    monitors: [monitor(interested), monitor(ignored, new Set(["interaction.other"]))],
    snapshot,
    interactionId: "interaction-1",
    traceId: "trace-1",
    timestampEpochMilliseconds: 1_700_000_000_000,
  });

  expect(interested).toHaveBeenCalledOnce();
  expect(ignored).not.toHaveBeenCalled();
  const event = seen[0];
  expect(event?.type).toBe("interaction.request.pre_authorization");
  expect(Object.isFrozen(event)).toBe(true);
  expect(Object.isFrozen(event?.payload)).toBe(true);
  expect(JSON.stringify(event)).not.toContain(secretText);
  expect(event?.payload).not.toHaveProperty("body");
  expect(() => {
    (event as { payload: unknown }).payload = {};
  }).toThrow(TypeError);
});
