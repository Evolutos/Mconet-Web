// Copyright © 2026 Mcont.

import type {
  CompatibilityPolicy,
  InteractionResourceLimits,
  ServiceAccess,
} from "@evolutos/mconet-core-domain";

/**
 * Immutable data overrides and lifecycle inputs for one interaction.
 *
 * The carrier contains only values consumed by configuration resolution. It
 * does not expose runtime component injection or monitoring behavior, and no
 * value stored here may be written back into reusable client configuration.
 * Validation, deadline conversion, signal composition, and merge behavior are
 * owned by later dedicated steps.
 */
export interface InteractionOptionsData {
  /** Optional service access data with precedence above reusable client defaults. */
  readonly serviceAccessOverride?: ServiceAccess;

  /** Optional compatibility strategy used only by this interaction. */
  readonly compatibilityPolicy?: CompatibilityPolicy;

  /** Optional per-field byte limits used only by this interaction. */
  readonly resourceLimits?: InteractionResourceLimits;

  /** Optional caller cancellation signal observed only by this interaction. */
  readonly signal?: AbortSignal;

  /** Optional absolute deadline value interpreted by the runtime deadline helper. */
  readonly deadline?: number;

  /** Whether this interaction requests a bounded raw response in its result. */
  readonly includeRawResponse?: boolean;
}
