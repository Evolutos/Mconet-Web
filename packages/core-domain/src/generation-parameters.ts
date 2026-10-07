// Copyright © 2026 Mcont.

import {
  getDenseArrayDescriptors,
  getRecordDescriptors,
  isDataDescriptor,
} from "./message-entry.js";

/**
 * Immutable protocol-neutral controls for one model-generation Task.
 *
 * Every field is independently optional so callers can express only the
 * controls they selected. Protocol adapters decide how supported controls map
 * to target requests under the active compatibility policy. Numeric ranges,
 * integer bounds, and stop-sequence content belong to the dedicated validator
 * below; this interface defines storage shape without normalizing values.
 */
export interface GenerationParameters {
  /** Optional sampling temperature retained independently from top-p. */
  readonly temperature?: number;

  /** Optional nucleus-sampling probability retained independently. */
  readonly topP?: number;

  /** Optional maximum number of tokens requested for generated output. */
  readonly maxOutputTokens?: number;

  /** Optional ordered stop sequences retained without provider mapping. */
  readonly stop?: readonly string[];

  /** Optional deterministic sampling seed when supported by the target. */
  readonly seed?: number;
}

/**
 * Determines whether an unknown value contains valid generation controls.
 *
 * The validator enforces only protocol-neutral semantics: finite non-negative
 * temperature, top-p probability, positive token count, usable ordered stop
 * sequences, and an exactly represented seed. It does not impose a provider's
 * temperature ceiling, stop-count limit, defaults, or compatibility behavior.
 * Unknown fields remain untouched for structural extension.
 *
 * @param value Untrusted Task configuration to validate.
 * @returns Whether every supplied control satisfies {@link GenerationParameters}.
 */
export function isGenerationParameters(value: unknown): value is GenerationParameters {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return false;
  }

  try {
    const prototype = Object.getPrototypeOf(value);
    // With every control optional, arbitrary host/class instances could
    // otherwise masquerade as an empty configuration. JSON-style records may
    // use the ordinary or null prototype; every other prototype fails closed.
    if (prototype !== Object.prototype && prototype !== null) {
      return false;
    }
  } catch {
    // A Proxy that cannot expose a stable prototype is not a trustworthy
    // configuration record, even if descriptor reflection happened to succeed.
    return false;
  }

  // Every control is independently optional. A present property must be an own
  // stored value, so accessors and explicit undefined never become omission.
  return (
    isOptionalFiniteRange(descriptors.temperature, 0) &&
    isOptionalFiniteRange(descriptors.topP, 0, 1) &&
    isOptionalPositiveSafeInteger(descriptors.maxOutputTokens) &&
    isOptionalStopSequences(descriptors.stop) &&
    isOptionalSafeInteger(descriptors.seed)
  );
}

/** Validates an optional canonical finite number within inclusive bounds. */
function isOptionalFiniteRange(
  descriptor: PropertyDescriptor | undefined,
  minimum: number,
  maximum?: number,
): boolean {
  if (descriptor === undefined) {
    return true;
  }
  if (
    !isDataDescriptor(descriptor) ||
    typeof descriptor.value !== "number" ||
    !Number.isFinite(descriptor.value) ||
    Object.is(descriptor.value, -0)
  ) {
    return false;
  }

  // Bounds are inclusive. An omitted maximum intentionally preserves target
  // neutrality for temperature while still excluding negative magnitudes.
  return descriptor.value >= minimum && (maximum === undefined || descriptor.value <= maximum);
}

/** Validates an optional positive integer that is exactly portable in JSON. */
function isOptionalPositiveSafeInteger(descriptor: PropertyDescriptor | undefined): boolean {
  if (descriptor === undefined) {
    return true;
  }

  // Positivity also rejects both signed forms of zero; safe-integer checking
  // excludes fractions, infinities, NaN, and imprecise token counts.
  return (
    isDataDescriptor(descriptor) && Number.isSafeInteger(descriptor.value) && descriptor.value > 0
  );
}

/** Validates an optional canonical signed safe integer seed. */
function isOptionalSafeInteger(descriptor: PropertyDescriptor | undefined): boolean {
  if (descriptor === undefined) {
    return true;
  }

  // Seeds may be negative because the domain is provider-neutral, but negative
  // zero is not a stable JSON representation and must not cross the boundary.
  return (
    isDataDescriptor(descriptor) &&
    Number.isSafeInteger(descriptor.value) &&
    !Object.is(descriptor.value, -0)
  );
}

/** Validates optional ordered stop sequences without normalizing their content. */
function isOptionalStopSequences(descriptor: PropertyDescriptor | undefined): boolean {
  if (descriptor === undefined) {
    return true;
  }
  if (!isDataDescriptor(descriptor)) {
    return false;
  }

  const sequenceDescriptors = getDenseArrayDescriptors(descriptor.value);
  if (sequenceDescriptors === undefined || sequenceDescriptors.length === 0) {
    return false;
  }

  for (const sequenceDescriptor of sequenceDescriptors) {
    // Zero-length strings cannot stop generation. Whitespace is deliberately
    // retained because newlines and separators are legitimate exact sequences.
    if (typeof sequenceDescriptor.value !== "string" || sequenceDescriptor.value.length === 0) {
      return false;
    }
  }
  return true;
}
