// Copyright © 2026 Mcont.

import type { Diagnostic } from "./diagnostic.js";
import type { JsonValue } from "./json-value.js";
import type { ModelInteractionError } from "./model-interaction-error.js";
import { SecretValue } from "./secret-value.js";

/** Fixed representation for an encountered secret wrapper. */
const redactedValue = "[REDACTED]";

/** Fixed representation for a cyclic reference in forged diagnostic details. */
const circularValue = "[CIRCULAR]";

/** Fixed representation for data that cannot be copied into the JSON model. */
const unserializableValue = "[UNSERIALIZABLE]";

/**
 * Produces an allowlisted, JSON-compatible representation of a model interaction error.
 *
 * Cause and stack are intentionally omitted. Diagnostic details are copied through
 * a fail-closed JSON sanitizer so secret wrappers, accessors, cyclic references,
 * platform objects, executable values, and non-finite numbers cannot enter the
 * returned structure. String content supplied by error producers must already be
 * sanitized because arbitrary plaintext strings cannot be identified reliably.
 *
 * @param error Structured model interaction error to serialize.
 * @returns Frozen JSON object containing only reviewed error fields.
 */
export function serializeModelInteractionError(
  error: ModelInteractionError,
): Readonly<Record<string, JsonValue>> {
  // Start from an explicit field allowlist instead of enumerating Error, which
  // prevents cause, stack, or future internal properties from entering output.
  const serialized: Record<string, JsonValue> = {
    name: error.name,
    message: error.message,
    category: error.category,
    phase: error.phase,
    code: error.code,
  };

  // Preserve optional scalar metadata only when it exists, matching the source
  // error's absence semantics without emitting undefined JSON values.
  if (error.statusCode !== undefined) {
    serialized.statusCode = copySafeJsonValue(error.statusCode, new Set());
  }
  if (error.serviceErrorCode !== undefined) {
    serialized.serviceErrorCode = error.serviceErrorCode;
  }
  if (error.requestId !== undefined) {
    serialized.requestId = error.requestId;
  }
  if (error.recovery !== undefined) {
    serialized.recovery = copySafeJsonValue(error.recovery, new Set());
  }

  // Rebuild every diagnostic from reviewed fields and freeze the resulting list
  // so callers cannot mutate the serialized error after it crosses a boundary.
  const diagnostics: JsonValue[] = [];
  for (const diagnostic of error.diagnostics) {
    diagnostics.push(serializeDiagnostic(diagnostic));
  }
  serialized.diagnostics = Object.freeze(diagnostics);

  // Freeze the top-level allowlist after every optional property is finalized.
  return Object.freeze(serialized);
}

/**
 * Copies one diagnostic through an explicit field allowlist.
 *
 * @param diagnostic Diagnostic to copy.
 * @returns Frozen JSON object containing reviewed diagnostic fields.
 */
function serializeDiagnostic(diagnostic: Diagnostic): Readonly<Record<string, JsonValue>> {
  // Required scalar fields are copied directly because their public types are
  // already JSON primitives and their names are part of the reviewed contract.
  const serialized: Record<string, JsonValue> = {
    code: diagnostic.code,
    severity: diagnostic.severity,
    phase: diagnostic.phase,
    message: diagnostic.message,
  };

  // Optional location and service fields retain omission, while details receive
  // recursive sanitization before entering the serializable snapshot.
  if (diagnostic.path !== undefined) {
    serialized.path = diagnostic.path;
  }
  if (diagnostic.serviceId !== undefined) {
    serialized.serviceId = diagnostic.serviceId;
  }
  if (diagnostic.details !== undefined) {
    serialized.details = copySafeJsonValue(diagnostic.details, new Set());
  }

  // Prevent post-serialization changes to the diagnostic field set.
  return Object.freeze(serialized);
}

/**
 * Converts unknown runtime data into a safe JSON value without invoking accessors.
 *
 * @param value Runtime value to copy.
 * @param ancestors Objects on the active traversal path for cycle detection.
 * @returns Safe JSON value or a stable replacement marker.
 */
function copySafeJsonValue(value: unknown, ancestors: Set<object>): JsonValue {
  // Preserve native JSON primitives, but replace non-finite numbers because the
  // JSON data model cannot represent them without lossy coercion to null.
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : unserializableValue;
  }

  // Recognize the opaque wrapper before generic object handling so no reflective
  // operation can inspect its internals. A hostile or revoked Proxy may throw
  // during the prototype check, in which case serialization fails closed.
  let isSecretValue: boolean;
  try {
    isSecretValue = value instanceof SecretValue;
  } catch {
    return unserializableValue;
  }
  if (isSecretValue) {
    return redactedValue;
  }

  // Functions, symbols, bigint, and undefined have no JSON representation and
  // are replaced rather than omitted so the loss remains visible and deterministic.
  if (typeof value !== "object") {
    return unserializableValue;
  }

  // Detect only active-path cycles; repeated non-cyclic references are copied at
  // each position so the returned value remains an ordinary JSON tree.
  if (ancestors.has(value)) {
    return circularValue;
  }
  ancestors.add(value);

  try {
    // Copy arrays in source order and recursively sanitize every item.
    if (Array.isArray(value)) {
      const items: JsonValue[] = [];
      for (const item of value) {
        items.push(copySafeJsonValue(item, ancestors));
      }
      return Object.freeze(items);
    }

    // Accept only ordinary records. Dates, typed arrays, Errors, and custom class
    // instances are represented by a marker rather than traversed reflectively.
    let prototype: object | null;
    try {
      prototype = Object.getPrototypeOf(value);
    } catch {
      return unserializableValue;
    }
    if (prototype !== Object.prototype && prototype !== null) {
      return unserializableValue;
    }

    // Read descriptors without evaluating getters. Enumerable accessors become a
    // marker, while enumerable data properties are recursively copied by value.
    let descriptors: Record<string, PropertyDescriptor>;
    try {
      descriptors = Object.getOwnPropertyDescriptors(value);
    } catch {
      return unserializableValue;
    }

    const record: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (!descriptor.enumerable) {
        continue;
      }
      record[key] =
        "value" in descriptor
          ? copySafeJsonValue(descriptor.value, ancestors)
          : unserializableValue;
    }

    return Object.freeze(record);
  } catch {
    // Iteration and other proxy-mediated operations may still throw after the
    // targeted descriptor checks; replace the entire value instead of failing.
    return unserializableValue;
  } finally {
    // Remove the current object even when reflective operations fail so sibling
    // branches cannot be misclassified as cycles.
    ancestors.delete(value);
  }
}
