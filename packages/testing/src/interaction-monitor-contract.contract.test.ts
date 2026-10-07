// Copyright © 2026 Mcont.

import type { InteractionMonitor, MonitoringEvent } from "@evolutos/mconet-core-spi";

import { defineInteractionMonitorContract } from "./interaction-monitor-contract.js";
import { RecordingMonitor } from "./recording-monitor.js";

/** Registers the shared suite against recording and rejecting monitor behaviors. */
defineInteractionMonitorContract("RecordingMonitor", () => {
  // Recreate every event, monitor, and snapshot source so publication history
  // and rejection state remain private to one contract case.
  const secretPlaintext = "contract-monitor-secret";
  const event: MonitoringEvent = {
    id: "event-contract",
    type: "interaction.did_complete",
    interactionId: "interaction-contract",
    traceId: "trace-contract",
    timestamp: { epochMilliseconds: 2_000_000_000_000 },
    payload: { status: "completed", credential: "[REDACTED]" },
    metadata: { environment: "contract" },
  };
  const descriptor: InteractionMonitor["descriptor"] = {
    name: "contract-interaction-monitor",
    version: "1.0.0",
    capabilities: new Set(),
    source: "application",
  };
  const monitor = new RecordingMonitor({ descriptor });
  const followingMonitor = new RecordingMonitor({ descriptor });
  const failure = new Error("contract monitor backend unavailable");
  let failureCount = 0;
  const failingMonitor: InteractionMonitor = {
    descriptor,
    onEvent(observedEvent) {
      // Acknowledge the immutable event identity without inspecting or changing
      // its sanitized payload before returning the configured rejection.
      void observedEvent;
      failureCount += 1;
      return Promise.reject(failure);
    },
  };
  const publish = async (
    monitors: readonly InteractionMonitor[],
    publishedEvent: MonitoringEvent,
  ): Promise<void> => {
    // Preserve declaration order and apply optional event filters before calling
    // each observer; one backend failure cannot terminate the publication loop.
    for (const candidate of monitors) {
      if (
        candidate.observedEvents !== undefined &&
        !candidate.observedEvents.has(publishedEvent.type)
      ) {
        continue;
      }

      try {
        await candidate.onEvent(publishedEvent);
      } catch {
        // Discard monitor-owned failures without retaining them, changing the
        // event, or preventing later observers from receiving the same identity.
      }
    }
  };

  // Snapshot callbacks expose only immutable test observations and do not add
  // history access or publisher control to the production monitor interface.
  return {
    secretPlaintext,
    event,
    monitor,
    getObservedEvents: () => monitor.snapshotEvents(),
    failingMonitor,
    failure,
    getFailureCount: () => failureCount,
    followingMonitor,
    getFollowingEvents: () => followingMonitor.snapshotEvents(),
    publish,
  };
});
