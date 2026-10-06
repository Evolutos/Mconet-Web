// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import { isOpenIdentifier, type OpenIdentifier } from "./open-identifier.js";

/**
 * Open description of a model addressable by an interaction protocol.
 *
 * `name` is the only required descriptive identity and is the value a protocol
 * adapter writes into its model-selection field. Optional labels, family, and
 * version provide matching or presentation context without becoming protocol
 * parameters. Metadata and extensions are always-present readonly JSON maps so
 * callers can use empty objects instead of introducing absence semantics.
 *
 * The interface is intentionally structural: applications and integrations may
 * implement it with additional domain fields. Untrusted values require runtime
 * validation at trust boundaries; this type alone performs no validation.
 */
export interface ModelDescriptor {
  /** Protocol-facing model name and sole required descriptive identity. */
  readonly name: string;

  /** Optional human-readable label that does not replace the protocol name. */
  readonly displayName?: string;

  /** Optional open family identifier used for matching related models. */
  readonly family?: OpenIdentifier;

  /** Optional provider-defined model version retained without interpretation. */
  readonly version?: string;

  /** Always-present, platform-neutral descriptive metadata. */
  readonly metadata: Readonly<Record<string, JsonValue>>;

  /** Always-present namespaced extension data for forward-compatible contracts. */
  readonly extensions: Extensions;
}

/**
 * Determines whether an unknown value satisfies the model descriptor contract.
 *
 * Required and optional known fields must be own data properties so validation
 * never executes accessors or trusts inherited values. Metadata and extensions
 * must be ordinary, acyclic JSON records with finite canonical numbers. Unknown
 * top-level fields remain allowed for structural forward compatibility and do
 * not participate in validation or control flow.
 *
 * @param value Untrusted value to validate.
 * @returns Whether the value is a valid {@link ModelDescriptor}.
 */
export function isModelDescriptor(value: unknown): value is ModelDescriptor {
  // Only non-array objects can carry the named fields required by the public
  // descriptor contract. Custom class instances remain eligible at this level.
  if (typeof value !== "object" || value === null || isArrayValue(value)) {
    return false;
  }

  // Capture every own descriptor without reading property values through normal
  // access. Proxy descriptor failures become invalid input instead of escaping.
  let descriptors: Record<string, PropertyDescriptor>;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return false;
  }

  const nameDescriptor = descriptors.name;
  const metadataDescriptor = descriptors.metadata;
  const extensionsDescriptor = descriptors.extensions;

  // Required fields must exist as own data properties. The name contract is a
  // string only; provider-specific syntax is deliberately not invented here.
  if (
    !isDataDescriptor(nameDescriptor) ||
    typeof nameDescriptor.value !== "string" ||
    !isDataDescriptor(metadataDescriptor) ||
    !isDataDescriptor(extensionsDescriptor)
  ) {
    return false;
  }

  // Optional values preserve true absence. An explicitly present undefined or
  // accessor is invalid under exact optional-property semantics.
  if (
    !isOptionalStringDescriptor(descriptors.displayName) ||
    !isOptionalOpenIdentifierDescriptor(descriptors.family) ||
    !isOptionalStringDescriptor(descriptors.version)
  ) {
    return false;
  }

  try {
    // Validate each declared map as its own JSON tree. Separate ancestor sets
    // permit safe shared subtrees across the two maps while rejecting cycles.
    return (
      isJsonRecord(metadataDescriptor.value, new Set<object>()) &&
      isJsonRecord(extensionsDescriptor.value, new Set<object>())
    );
  } catch {
    // Extremely deep input can overflow recursive traversal, and hostile proxy
    // operations may throw below reflective checks. Both fail closed.
    return false;
  }
}

/**
 * Checks that a property descriptor stores a value rather than invoking accessors.
 *
 * @param descriptor Own property descriptor to inspect.
 * @returns Whether the descriptor exists and contains a data value.
 */
function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { readonly value: unknown } {
  // The `value` key distinguishes data descriptors even when the stored value
  // itself is undefined.
  return descriptor !== undefined && "value" in descriptor;
}

/**
 * Validates an optional own string data property.
 *
 * @param descriptor Optional property descriptor.
 * @returns Whether the property is absent or stores a string value.
 */
function isOptionalStringDescriptor(descriptor: PropertyDescriptor | undefined): boolean {
  // Absence is valid; presence requires a data descriptor and an exact string.
  return (
    descriptor === undefined ||
    (isDataDescriptor(descriptor) && typeof descriptor.value === "string")
  );
}

/**
 * Validates an optional own open-identifier data property.
 *
 * @param descriptor Optional property descriptor.
 * @returns Whether the property is absent or stores a valid open identifier.
 */
function isOptionalOpenIdentifierDescriptor(descriptor: PropertyDescriptor | undefined): boolean {
  // Delegate identifier syntax to the existing single source of truth without
  // reading accessors or normalizing the supplied value.
  return (
    descriptor === undefined || (isDataDescriptor(descriptor) && isOpenIdentifier(descriptor.value))
  );
}

/**
 * Determines whether a runtime value is an array while containing Proxy failures.
 *
 * @param value Candidate runtime value.
 * @returns Whether the value is a non-revoked array.
 */
function isArrayValue(value: unknown): value is readonly unknown[] {
  try {
    // Array.isArray normally avoids user code, but the ECMAScript IsArray
    // operation throws for a revoked Proxy and must remain inside this boundary.
    return Array.isArray(value);
  } catch {
    return false;
  }
}

/**
 * Validates a runtime value as a plain JSON object record.
 *
 * @param value Candidate record value.
 * @param ancestors Objects on the active traversal path for cycle detection; a
 * new traversal set is created when another core-domain validator starts here.
 * @returns Whether the value is an ordinary JSON-compatible record.
 * @internal Shared by core-domain validators but not re-exported by the package entry.
 */
export function isJsonRecord(
  value: unknown,
  ancestors: Set<object> = new Set<object>(),
): value is Readonly<Record<string, JsonValue>> {
  // Arrays have their own ordered validation path; null and primitives cannot
  // satisfy the declared map contract.
  if (typeof value !== "object" || value === null || isArrayValue(value)) {
    return false;
  }

  let prototype: object | null;
  let keys: readonly PropertyKey[];
  try {
    // Restrict records to ordinary or null prototypes, then capture every own
    // string and symbol key without invoking a property getter.
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    return false;
  }

  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  if (ancestors.has(value)) {
    return false;
  }
  ancestors.add(value);

  try {
    for (const key of keys) {
      // JSON objects cannot represent symbol keys. String keys such as
      // `__proto__` remain ordinary data keys and are not assigned anywhere.
      if (typeof key !== "string") {
        return false;
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      // Parsed JSON members are enumerable data properties. Reject accessors and
      // hidden state rather than invoking or silently omitting either form.
      if (!isDataDescriptor(descriptor) || descriptor.enumerable !== true) {
        return false;
      }
      if (!isJsonValue(descriptor.value, ancestors)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  } finally {
    // Remove the current record on every exit so repeated non-cyclic references
    // in sibling branches remain valid JSON serialization inputs.
    ancestors.delete(value);
  }
}

/**
 * Validates one recursive JSON value without coercion or getter execution.
 *
 * @param value Candidate JSON value.
 * @param ancestors Objects on the active traversal path for cycle detection.
 * @returns Whether the candidate belongs to the language-neutral JSON model.
 */
function isJsonValue(value: unknown, ancestors: Set<object>): value is JsonValue {
  // Preserve JSON scalar types exactly. Finite numbers exclude NaN/infinities,
  // and negative zero is rejected because JSON encoding loses its sign.
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && !Object.is(value, -0);
  }

  // Arrays and records recurse through separate shape rules. Undefined, bigint,
  // symbol, and function values reach neither branch and are rejected.
  if (isArrayValue(value)) {
    return isJsonArray(value, ancestors);
  }
  return isJsonRecord(value, ancestors);
}

/**
 * Validates a dense ordinary array as an ordered JSON value collection.
 *
 * @param value Candidate array.
 * @param ancestors Objects on the active traversal path for cycle detection.
 * @returns Whether every own array element is a JSON value.
 */
function isJsonArray(
  value: readonly unknown[],
  ancestors: Set<object>,
): value is readonly JsonValue[] {
  let prototype: object | null;
  let keys: readonly PropertyKey[];
  let lengthDescriptor: PropertyDescriptor | undefined;

  try {
    // Reject array subclasses and collect descriptors without reading elements,
    // preventing indexed getters or Proxy traps from being treated as JSON data.
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  } catch {
    return false;
  }

  if (
    prototype !== Array.prototype ||
    !isDataDescriptor(lengthDescriptor) ||
    typeof lengthDescriptor.value !== "number" ||
    lengthDescriptor.enumerable !== false ||
    keys.length !== lengthDescriptor.value + 1 ||
    ancestors.has(value)
  ) {
    return false;
  }
  ancestors.add(value);

  try {
    for (const key of keys) {
      if (key === "length") {
        continue;
      }

      // Dense arrays contain only canonical non-negative index strings below
      // length. Symbols, holes, and unrelated own properties are invalid.
      if (typeof key !== "string") {
        return false;
      }
      const index = Number(key);
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= lengthDescriptor.value ||
        String(index) !== key
      ) {
        return false;
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!isDataDescriptor(descriptor) || descriptor.enumerable !== true) {
        return false;
      }
      if (!isJsonValue(descriptor.value, ancestors)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  } finally {
    // Active-path tracking rejects cycles without disallowing a repeated array
    // reference that can be serialized independently in two sibling positions.
    ancestors.delete(value);
  }
}
