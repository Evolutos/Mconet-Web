// Copyright © 2026 Mcont.

/**
 * Facts that may help a caller decide how to recover from an interaction error.
 *
 * Every field is optional because a component may know only part of the recovery
 * state. Absence means unknown and remains distinct from `false` or zero. These
 * hints never authorize the SDK to retry an interaction automatically.
 */
export interface RecoveryHint {
  /** Whether the observed failure condition is expected to be temporary. */
  readonly transient?: boolean;

  /** Suggested non-negative whole delay before a caller-managed retry, in milliseconds. */
  readonly retryAfterMilliseconds?: number;

  /** Whether the remote service may have accepted or acted on the request. */
  readonly requestMayHaveBeenProcessed?: boolean;
}
