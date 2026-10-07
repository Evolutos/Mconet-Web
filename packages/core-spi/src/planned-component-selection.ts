// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

import type { ComponentRole } from "./component-role.js";

/**
 * Immutable component requirements declared for one execution-chain role.
 *
 * Required controls whether resolution may omit the role. Capability membership
 * independently constrains any component selected for that role. This planning
 * value does not carry a component instance, descriptor, candidate list, source
 * priority, ownership decision, or resolution result.
 */
export interface PlannedComponentSelection {
  /** Execution-chain position for which a component may be selected. */
  readonly role: ComponentRole;

  /** Whether absence of a compatible component must fail resolution. */
  readonly required: boolean;

  /** Capabilities every compatible component for this role must declare. */
  readonly requiredCapabilities: ReadonlySet<OpenIdentifier>;
}
