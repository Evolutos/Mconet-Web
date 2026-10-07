// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

import type { MonitoringEvent } from "./monitoring-event.js";
import type { RuntimeComponent } from "./runtime-component.js";

/**
 * Replaceable read-only observer of sanitized model interaction events.
 *
 * A monitor receives only the portable event snapshot and has no request,
 * response, credential, continuation, or mutable runtime handle with which to
 * change or block the interaction. An omitted event filter means the monitor is
 * interested in every published event; filtering and rejection isolation remain
 * responsibilities of the later monitoring publisher.
 */
export interface InteractionMonitor extends RuntimeComponent {
  /** Optional immutable set of event types this monitor wants to observe. */
  readonly observedEvents?: ReadonlySet<OpenIdentifier>;

  /** Observes one already-sanitized event without returning interaction data. */
  onEvent(event: MonitoringEvent): Promise<void>;
}
