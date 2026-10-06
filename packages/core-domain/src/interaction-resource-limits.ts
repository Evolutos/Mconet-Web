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

/** Resource-limit fields validated independently when present. */
const resourceLimitFieldNames = [
  "maxResponseBodyBytes",
  "maxStreamingErrorBodyBytes",
  "maxFrameBytes",
] as const satisfies readonly (keyof InteractionResourceLimits)[];

/**
 * Determines whether an unknown value contains valid interaction byte limits.
 *
 * An empty object is valid because unresolved configuration layers may omit
 * every override. Each present field must be an own data property containing a
 * positive safe integer, which prevents zero or negative unlimited sentinels,
 * fractions, non-finite numbers, and values JavaScript cannot represent exactly.
 * Unknown fields remain available for structural extension but are never read.
 *
 * @param value Untrusted unresolved or resolved resource-limit value.
 * @returns Whether every supplied byte limit is valid.
 */
export function isInteractionResourceLimits(value: unknown): value is InteractionResourceLimits {
  // Resource limits are a named configuration object, never a primitive, null,
  // array, or callable value.
  if (typeof value !== "object" || value === null) {
    return false;
  }

  let descriptors: Record<string, PropertyDescriptor>;
  try {
    // Reject ordered collections and capture own descriptors without invoking
    // getters; revoked or hostile Proxy operations fail closed below.
    if (Array.isArray(value)) {
      return false;
    }
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return false;
  }

  // Validate only the three owned contract fields. Absence is a legitimate
  // unresolved override, while presence requires stored exact byte-count data.
  return resourceLimitFieldNames.every((fieldName) => {
    const descriptor = descriptors[fieldName];
    if (descriptor === undefined) {
      return true;
    }

    // Accessors and explicitly stored undefined values are invalid. Requiring a
    // positive safe integer simultaneously enforces finiteness and precision.
    return "value" in descriptor && Number.isSafeInteger(descriptor.value) && descriptor.value > 0;
  });
}
