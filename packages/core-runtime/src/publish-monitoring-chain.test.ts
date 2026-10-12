// Copyright © 2026 Mcont.

import type { InteractionMonitor, MonitoringEvent } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { publishMonitoringChain } from "./publish-monitoring-chain.js";

const event: MonitoringEvent = {
  id: "event-1",
  type: "interaction.completed",
  interactionId: "interaction-1",
  timestamp: { epochMilliseconds: 1 },
  payload: { status: "completed" },
  metadata: {},
};

function monitor(
  name: string,
  order: string[],
  observedEvents?: ReadonlySet<string>,
): InteractionMonitor {
  return {
    descriptor: {
      name,
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    ...(observedEvents === undefined ? {} : { observedEvents }),
    async onEvent(): Promise<void> {
      order.push(name);
    },
  };
}

it("calls interested monitors in declaration order", async () => {
  const order: string[] = [];

  await publishMonitoringChain({
    monitors: [
      monitor("first", order),
      monitor("skipped", order, new Set(["interaction.other"])),
      monitor("second", order),
    ],
    event,
  });

  expect(order).toEqual(["first", "second"]);
});
