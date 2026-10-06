// Copyright © 2026 Mcont.

import type {
  CompatibilityPolicy,
  InteractionResourceLimits,
  ModelTarget,
  ServiceAccess,
} from "@evolutos/mconet-core-domain";

/**
 * Immutable reusable domain-data defaults owned by one model client.
 *
 * Every field is optional so client construction can defer missing values to a
 * request, interaction, integration, or finite SDK fallback. Runtime component
 * instances, monitoring behavior, cancellation signals, deadlines, and
 * interaction-only response options use separate resolution paths and are not
 * part of this pure data carrier.
 */
export interface ModelClientConfigurationData {
  /** Optional model target used when a request does not select one. */
  readonly defaultTarget?: ModelTarget;

  /** Optional service access data available below request and interaction overrides. */
  readonly defaultServiceAccess?: ServiceAccess;

  /** Optional compatibility strategy used below a single-interaction override. */
  readonly defaultCompatibilityPolicy?: CompatibilityPolicy;

  /** Optional per-field byte limits used below single-interaction limits. */
  readonly defaultResourceLimits?: InteractionResourceLimits;
}
