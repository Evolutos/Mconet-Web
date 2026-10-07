// Copyright © 2026 Mcont.

import type { InteractionMonitor } from "@evolutos/mconet-core-spi";

/**
 * InteractionMonitor test double that records already-sanitized events.
 *
 * The monitor preserves event identities and publication order for assertions.
 * It does not filter dispatch itself, inspect redaction, mutate payloads, control
 * interactions, publish follow-up events, or expose mutable history.
 */
export class RecordingMonitor implements InteractionMonitor {
  /** Immutable component metadata exposed through the SPI boundary. */
  public readonly descriptor: InteractionMonitor["descriptor"];

  /** Optional publisher-facing event filter preserved from configuration. */
  declare public readonly observedEvents?: NonNullable<InteractionMonitor["observedEvents"]>;

  /** Ordered sanitized event identities owned exclusively by this instance. */
  readonly #events: Array<Parameters<InteractionMonitor["onEvent"]>[0]> = [];

  /**
   * Captures component metadata and an optional publisher-facing filter.
   *
   * @param configuration Stable descriptor and optional observed event types.
   */
  public constructor(configuration: {
    readonly descriptor: InteractionMonitor["descriptor"];
    readonly observedEvents?: NonNullable<InteractionMonitor["observedEvents"]>;
  }) {
    // Copy the descriptor and create the declared optional property only when a
    // filter exists, preserving true omission for the all-events convention.
    this.descriptor = configuration.descriptor;
    if (configuration.observedEvents !== undefined) {
      this.observedEvents = configuration.observedEvents;
    }
  }

  /**
   * Records one already-sanitized monitoring event.
   *
   * @param event Portable event snapshot supplied by the publisher.
   * @returns Promise resolved after the event is recorded.
   */
  public async onEvent(event: Parameters<InteractionMonitor["onEvent"]>[0]): Promise<void> {
    // Append the original identity before resolving so publication order and
    // repeated event instances remain observable without cloning JSON data.
    this.#events.push(event);
  }

  /**
   * Returns an immutable snapshot of recorded sanitized events.
   *
   * @returns Frozen event identities in exact publication order.
   */
  public snapshotEvents(): ReadonlyArray<Parameters<InteractionMonitor["onEvent"]>[0]> {
    // Copy before freezing so later publications cannot alter an earlier
    // assertion and callers cannot mutate the private event history.
    return Object.freeze([...this.#events]);
  }
}
