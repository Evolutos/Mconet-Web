// Copyright © 2026 Mcont.

import { describe, expect, it } from "vitest";

import type { InteractionMonitor, MonitoringEvent } from "@evolutos/mconet-core-spi";

import { assertSecretAbsent } from "./assert-secret-absent.js";

/** Complete reusable fixture required by the InteractionMonitor contract suite. */
export interface InteractionMonitorContractFixture {
  /** Plaintext used only to detect accidental monitoring disclosure. */
  readonly secretPlaintext: string;
  /** Bounded and sanitized event supplied to every observation path. */
  readonly event: MonitoringEvent;
  /** Fresh successful monitor used for read-only observation checks. */
  readonly monitor: InteractionMonitor;
  /** Returns the successful monitor's immutable observed-event snapshot. */
  readonly getObservedEvents: () => readonly MonitoringEvent[];
  /** Fresh monitor configured to reject event observation. */
  readonly failingMonitor: InteractionMonitor;
  /** Exact expected failure from the rejecting monitor. */
  readonly failure: Error;
  /** Returns the rejecting monitor's invocation count. */
  readonly getFailureCount: () => number;
  /** Fresh monitor placed after the rejecting monitor in publication order. */
  readonly followingMonitor: InteractionMonitor;
  /** Returns the following monitor's immutable observed-event snapshot. */
  readonly getFollowingEvents: () => readonly MonitoringEvent[];
  /** Publishes one event while isolating individual monitor failures. */
  readonly publish: (
    monitors: readonly InteractionMonitor[],
    event: MonitoringEvent,
  ) => Promise<void>;
}

/**
 * Registers the reusable behavioral contract for one InteractionMonitor path.
 *
 * @param name Stable implementation name shown in contract test reports.
 * @param createFixture Factory returning isolated observation and failure fixtures.
 */
export function defineInteractionMonitorContract(
  name: string,
  createFixture: () => InteractionMonitorContractFixture,
): void {
  // Obtain a fresh event and monitor chain per case so recorded observations or
  // failures cannot cross test boundaries and conceal mutation or leakage.
  describe(`${name} InteractionMonitor contract`, () => {
    it("observes a sanitized event without mutating it or exposing secret plaintext", async () => {
      const { event, getObservedEvents, monitor, secretPlaintext } = createFixture();
      const eventSnapshot = structuredClone(event);

      // Scan before delivery to prove the fixture itself satisfies the sanitized
      // event precondition rather than relying on monitor behavior to remove data.
      expect(secretPlaintext.length).toBeGreaterThan(0);
      assertSecretAbsent(secretPlaintext, event);
      await expect(monitor.onEvent(event)).resolves.toBeUndefined();

      const observedEvents = getObservedEvents();
      expect(observedEvents).toHaveLength(1);
      expect(observedEvents[0]).toBe(event);
      expect(event).toEqual(eventSnapshot);
      assertSecretAbsent(secretPlaintext, event, observedEvents);
    });

    it("isolates a monitor rejection and continues ordered publication safely", async () => {
      const {
        event,
        failingMonitor,
        failure,
        followingMonitor,
        getFailureCount,
        getFollowingEvents,
        publish,
        secretPlaintext,
      } = createFixture();
      const eventSnapshot = structuredClone(event);

      // A real Error proves the first monitor rejects, while publish must absorb
      // that observation failure and still invoke the later monitor in order.
      expect(failure).toBeInstanceOf(Error);
      expect(getFailureCount()).toBe(0);
      await expect(failingMonitor.onEvent(event)).rejects.toBe(failure);
      expect(getFailureCount()).toBe(1);
      await expect(publish([failingMonitor, followingMonitor], event)).resolves.toBeUndefined();
      expect(getFailureCount()).toBe(2);

      const followingEvents = getFollowingEvents();
      expect(followingEvents).toHaveLength(1);
      expect(followingEvents[0]).toBe(event);
      expect(event).toEqual(eventSnapshot);
      assertSecretAbsent(secretPlaintext, event, failure, followingEvents);
    });
  });
}
