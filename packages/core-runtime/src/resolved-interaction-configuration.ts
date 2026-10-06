// Copyright © 2026 Mcont.

import type {
  CompatibilityPolicy,
  ModelTarget,
  ResolvedInteractionResourceLimits,
  ServiceAccess,
} from "@evolutos/mconet-core-domain";

/**
 * Complete immutable result of selecting interaction configuration data.
 *
 * Every property is required so consumers must represent unresolved absence
 * explicitly instead of accidentally omitting part of the snapshot. Target,
 * compatibility policy, and byte limits are concrete after selection. Service
 * access may remain absent until a later access resolver contributes an
 * integration default, and a signal may be absent when the caller supplied no
 * cancellation source. The snapshot contains no component, monitoring, secret,
 * deadline, or raw-response state.
 */
export interface ResolvedInteractionConfiguration {
  /** Model target selected from request data or the reusable client default. */
  readonly target: ModelTarget;

  /** Winning whole access input, or explicit absence before access resolution. */
  readonly serviceAccess: ServiceAccess | undefined;

  /** Concrete compatibility strategy selected for this interaction. */
  readonly compatibilityPolicy: CompatibilityPolicy;

  /** Complete finite byte limits shared by downstream runtime consumers. */
  readonly resourceLimits: ResolvedInteractionResourceLimits;

  /** Caller-owned cancellation signal, or explicit absence for this interaction. */
  readonly signal: AbortSignal | undefined;
}
