// Copyright © 2026 Mcont.

/**
 * Non-negative elapsed time represented at whole-millisecond precision.
 *
 * Milliseconds provide one unit across browser and Node.js runtimes. Untrusted
 * values must pass the dedicated validator, which enforces non-negativity,
 * finiteness, integer precision, and the JSON safe-integer range.
 */
export interface Duration {
  /** Non-negative whole milliseconds; zero represents no elapsed time. */
  readonly milliseconds: number;
}

/**
 * Determines whether an unknown value is a valid duration object.
 *
 * The milliseconds member must be an own data property containing a canonical
 * non-negative safe integer. Accessor properties are rejected without invoking
 * them, and unrelated fields remain allowed for forward-compatible boundaries.
 *
 * @param value Untrusted value to validate.
 * @returns Whether the value is a valid {@link Duration}.
 */
export function isDuration(value: unknown): value is Duration {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, "milliseconds");
  } catch {
    return false;
  }

  if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "number") {
    return false;
  }

  return (
    Number.isSafeInteger(descriptor.value) &&
    descriptor.value >= 0 &&
    !Object.is(descriptor.value, -0)
  );
}
