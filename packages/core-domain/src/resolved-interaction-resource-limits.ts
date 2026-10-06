// Copyright © 2026 Mcont.

/**
 * Complete byte limits produced by interaction configuration resolution.
 *
 * Every field is required because resolution must replace omitted input values
 * with lower-priority configuration or finite SDK defaults. Positivity, integer
 * precision, and portable range checks remain the responsibility of the shared
 * resource-limit validator rather than this representation-only interface.
 */
export interface ResolvedInteractionResourceLimits {
  /** Maximum bytes accepted for one complete unary response body. */
  readonly maxResponseBodyBytes: number;

  /** Maximum bytes collected from an initial streaming error response. */
  readonly maxStreamingErrorBodyBytes: number;

  /** Maximum encoded bytes accepted for one framed streaming event. */
  readonly maxFrameBytes: number;
}
