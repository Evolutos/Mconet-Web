// Copyright © 2026 Mcont.

import type { Diagnostic } from "@evolutos/mconet-core-domain";

import type { CapabilityRequirement } from "./capability-requirement.js";

/**
 * Immutable facts produced after resolving one interaction's capabilities.
 *
 * Satisfied requirements and unsupported optional requirements retain their
 * declared order and exact values. Diagnostics record portable observations from
 * resolution. A missing required capability prevents successful resolution and
 * therefore is not represented as an ordinary result item. This value carries
 * no mutable provider, component instance, resolver, retry action, or request.
 */
export interface CapabilityResolution {
  /** Ordered requirements proven available for the current interaction. */
  readonly satisfied: readonly CapabilityRequirement[];

  /** Ordered optional requirements for which no compatible capability was found. */
  readonly optionalUnsupported: readonly CapabilityRequirement[];

  /** Ordered portable diagnostics emitted while resolving capabilities. */
  readonly diagnostics: readonly Diagnostic[];
}
