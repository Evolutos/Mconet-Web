// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

/**
 * Immutable criteria used to select one transport for a protocol plan.
 *
 * The optional open kind identifies a transport family without naming a concrete
 * component. Required capabilities form an order-independent set that every
 * compatible candidate must declare. Discovery, priority, compatibility checks,
 * and ambiguity handling remain responsibilities of the component resolver.
 */
export interface TransportSelection {
  /** Optional open identifier for the protocol plan's transport family. */
  readonly transportKind?: OpenIdentifier;

  /** Capabilities every compatible transport component must declare. */
  readonly requiredCapabilities: ReadonlySet<OpenIdentifier>;
}
