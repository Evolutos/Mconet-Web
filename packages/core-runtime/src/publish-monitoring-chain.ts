// Copyright © 2026 Mcont.

import type { InteractionMonitor, MonitoringEvent } from "@evolutos/mconet-core-spi";

/**
 * Publishes one event to monitors in declaration order.
 *
 * Each interested monitor is awaited before the next monitor runs. A monitor
 * whose `observedEvents` set omits the event type is skipped and does not
 * change the order of the monitors that do run. This stage does not replace
 * the interaction result. A monitor rejection stops the chain; isolation of
 * that rejection is a separate stage.
 *
 * @param input Monitors in caller order and the event to publish.
 */
export async function publishMonitoringChain(input: {
  readonly monitors: readonly InteractionMonitor[];
  readonly event: MonitoringEvent;
}): Promise<void> {
  for (const monitor of input.monitors) {
    if (monitor.observedEvents !== undefined && !monitor.observedEvents.has(input.event.type)) {
      continue;
    }
    await monitor.onEvent(input.event);
  }
}
