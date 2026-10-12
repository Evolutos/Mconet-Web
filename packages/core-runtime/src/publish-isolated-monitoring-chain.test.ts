// Copyright © 2026 Mcont.

import type { InteractionMonitor, MonitoringEvent } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { publishIsolatedMonitoringChain } from "./publish-isolated-monitoring-chain.js";

const event: MonitoringEvent = {
  id: "event-1",
  type: "interaction.completed",
  interactionId: "interaction-1",
  timestamp: { epochMilliseconds: 1 },
  payload: { status: "completed" },
  metadata: {},
};

function monitor(name: string, order: string[], fail: boolean): InteractionMonitor {
  return {
    descriptor: {
      name,
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    async onEvent(): Promise<void> {
      order.push(name);
      if (fail) {
        throw new Error("monitor-secret");
      }
    },
  };
}

it("keeps the interaction result when a monitor fails", async () => {
  const order: string[] = [];
  const result = { status: "completed" };
  const published = await publishIsolatedMonitoringChain({
    monitors: [monitor("first", order, true), monitor("second", order, false)],
    event,
    result,
  });

  expect(published.result).toBe(result);
  expect(order).toEqual(["first", "second"]);
  expect(published.monitorFailures).toHaveLength(1);
  expect(published.result).not.toHaveProperty("message", "monitor-secret");
});
