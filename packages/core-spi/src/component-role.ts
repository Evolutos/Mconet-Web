// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

/**
 * Immutable open identity for one position in the runtime execution chain.
 *
 * A role describes where one uniquely selected component participates in a plan
 * or execution snapshot. It is not a component identity, registry key, caller
 * configuration field, implementation instance, or priority. Open identifiers
 * allow future execution modes to add roles without changing this value shape.
 */
export interface ComponentRole {
  /** Standard or integration-defined execution-chain role identifier. */
  readonly id: OpenIdentifier;
}
