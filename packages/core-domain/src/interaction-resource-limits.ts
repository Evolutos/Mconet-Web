// Copyright © 2026 Mcont.

/**
 * Optional byte limits supplied before interaction configuration resolution.
 *
 * Each field may be omitted independently so an interaction can override one
 * client limit without replacing the others. Positivity, safe integer range,
 * cross-language portability, and finite SDK fallbacks belong to the dedicated
 * validation and resolution steps; this interface only defines input shape.
 */
export interface InteractionResourceLimits {
  /** Maximum bytes accepted for one complete unary response body. */
  readonly maxResponseBodyBytes?: number;

  /** Maximum bytes collected from an initial streaming error response. */
  readonly maxStreamingErrorBodyBytes?: number;

  /** Maximum encoded bytes accepted for one framed streaming event. */
  readonly maxFrameBytes?: number;
}
