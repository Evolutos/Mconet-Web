// Copyright © 2026 Mcont.

import type { InteractionMonitor, MonitoringEvent } from "@evolutos/mconet-core-spi";

import { publishMonitoringChain } from "./publish-monitoring-chain.js";

/**
 * Publishes one event without letting a monitor replace the interaction result.
 *
 * Monitors still run in declaration order. A rejection is retained and the next
 * monitor still runs. The caller's result is returned by the same reference.
 *
 * @typeParam Result Primary interaction result that monitors must not replace.
 * @param input Monitors, event, and the result already produced for the caller.
 * @returns The original result and any monitor failures.
 */
export async function publishIsolatedMonitoringChain<Result>(input: {
  readonly monitors: readonly InteractionMonitor[];
  readonly event: MonitoringEvent;
  readonly result: Result;
}): Promise<{
  readonly result: Result;
  readonly monitorFailures: readonly unknown[];
}> {
  const monitorFailures: unknown[] = [];

  for (const monitor of input.monitors) {
    try {
      // One monitor per call keeps declaration order while containing its rejection.
      await publishMonitoringChain({ monitors: [monitor], event: input.event });
    } catch (caught) {
      monitorFailures.push(caught);
    }
  }

  return {
    result: input.result,
    monitorFailures: Object.freeze(monitorFailures),
  };
}
