// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

/**
 * Immutable declaration that one execution path requests a capability.
 *
 * The open identity preserves standard, integration-defined, and future
 * capabilities. Requiredness explicitly distinguishes a missing capability that
 * must fail execution from an optional capability that may produce a diagnostic.
 * This value does not evaluate support, identify a provider, carry constraints,
 * select a component, apply compatibility policy, or record resolution results.
 */
export interface CapabilityRequirement {
  /** Standard or integration-defined identity of the requested capability. */
  readonly capabilityId: OpenIdentifier;

  /** Whether absence of this capability must prevent execution. */
  readonly required: boolean;
}
