// Copyright © 2026 Mcont.

import type { ServiceAccess } from "@evolutos/mconet-core-domain";

import type { ModelIntegrationMatch } from "./model-integration-match.js";
import type { RuntimeComponent } from "./runtime-component.js";

/**
 * Immutable integration inputs fixed for one model interaction.
 *
 * Direct plans contain the explicitly injected protocol adapter and no binding
 * state. Resolved plans snapshot binding provenance, successful match facts,
 * optional access defaults, and ordered concrete component candidates. Plan
 * creators enforce those source-specific invariants before exposing this value.
 */
export interface ModelIntegrationPlan {
  /** Closed provenance distinguishing direct injection from resolver output. */
  readonly source: "direct_adapter" | "resolved_binding";

  /** Resolved binding diagnostic label, absent from a direct adapter plan. */
  readonly bindingId?: string;

  /** Resolved binding version snapshot, absent from a direct adapter plan. */
  readonly bindingVersion?: string;

  /** Completed successful match facts, absent from a direct adapter plan. */
  readonly match?: ModelIntegrationMatch;

  /** Exact protocol adapter component fixed for this interaction. */
  readonly taskProtocolAdapter: RuntimeComponent;

  /** Ordered binding-owned authorization handler candidates. */
  readonly authorizationHandlers: readonly RuntimeComponent[];

  /** Optional binding-owned access defaults for later access resolution. */
  readonly defaultServiceAccess?: ServiceAccess;

  /** Ordered binding-owned payload encoder candidates. */
  readonly payloadEncoders: readonly RuntimeComponent[];

  /** Ordered binding-owned success and error decoder candidates. */
  readonly payloadDecoders: readonly RuntimeComponent[];

  /** Ordered binding-owned transport candidates. */
  readonly transports: readonly RuntimeComponent[];

  /** Read-only top-level snapshot of plan-specific opaque local values. */
  readonly extensions: Readonly<Record<string, unknown>>;
}
