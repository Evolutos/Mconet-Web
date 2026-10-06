// Copyright © 2026 Mcont.

/** Stable error prefix for values outside the supported JSON data model. */
const invalidJsonValueMessage = "Canonical JSON comparison requires a valid JsonValue";

/**
 * Compares two JSON values after recursively normalizing object member order.
 *
 * This utility is intended for fixtures and contract tests. It does not mutate
 * either input and must not be used to reorder production request payloads.
 *
 * @param left First runtime value to validate and compare.
 * @param right Second runtime value to validate and compare.
 * @returns Whether both inputs have the same JSON data semantics.
 * @throws {TypeError} When either input violates the supported JSON data model.
 */
export function areJsonValuesCanonicallyEqual(left: unknown, right: unknown): boolean {
  // Normalize each input independently so a cycle or invalid value on either
  // side fails explicitly instead of being hidden by partial comparison.
  const canonicalLeft = serializeCanonicalJsonValue(left, new Set());
  const canonicalRight = serializeCanonicalJsonValue(right, new Set());

  // Canonical strings use the same member order and primitive representation,
  // so exact string equality is equivalent to recursive JSON-value equality.
  return canonicalLeft === canonicalRight;
}

/**
 * Serializes one validated JSON value into a deterministic comparison form.
 *
 * @param value Runtime value at the current traversal position.
 * @param ancestors Objects on the active path, used to reject cycles.
 * @returns Deterministic JSON text for comparison only.
 * @throws {TypeError} When the runtime value is not safely representable as JSON.
 */
function serializeCanonicalJsonValue(value: unknown, ancestors: Set<object>): string {
  // Primitive branches are handled before object traversal so null is not
  // mistaken for an object and each scalar retains its JSON representation.
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return serializeCanonicalJsonNumber(value);
  }

  // Every remaining valid branch must be an array or object. Reject unsupported
  // primitives explicitly instead of inheriting JSON.stringify's omission rules.
  if (typeof value !== "object") {
    throw new TypeError(`${invalidJsonValueMessage}: unsupported primitive value.`);
  }

  // Runtime fixture loaders can introduce cycles despite the JSON contract, so
  // active-path repetition is rejected explicitly.
  if (ancestors.has(value)) {
    throw new TypeError(`${invalidJsonValueMessage}: cyclic reference.`);
  }
  ancestors.add(value);

  try {
    // Arrays retain element order, whereas object member order is normalized by
    // the dedicated object serializer below.
    return Array.isArray(value)
      ? serializeCanonicalJsonArray(value, ancestors)
      : serializeCanonicalJsonObject(value, ancestors);
  } finally {
    // Remove only the current node so repeated, non-cyclic object references in
    // separate branches are compared as ordinary duplicated JSON values.
    ancestors.delete(value);
  }
}

/**
 * Serializes a JSON number without allowing JSON.stringify to coerce it.
 *
 * @param value Number to serialize.
 * @returns Deterministic JSON number text.
 * @throws {TypeError} When the value is non-finite or an unsafe integer.
 */
function serializeCanonicalJsonNumber(value: number): string {
  // JSON cannot represent NaN or infinities, and silently converting them to
  // null would make distinct invalid inputs appear canonically equal.
  if (!Number.isFinite(value)) {
    throw new TypeError(`${invalidJsonValueMessage}: numbers must be finite.`);
  }

  // Preserve the portable integer boundary required by the base serialization
  // contract; floating-point values remain valid when JSON can round-trip them.
  if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
    throw new TypeError(`${invalidJsonValueMessage}: integers must be safe integers.`);
  }

  // JSON defines negative zero and zero with the same textual representation.
  return Object.is(value, -0) ? "0" : JSON.stringify(value);
}

/**
 * Serializes a JSON array while preserving its element order.
 *
 * @param value Array to serialize.
 * @param ancestors Objects on the active traversal path.
 * @returns Deterministic JSON array text.
 * @throws {TypeError} When an item is missing, undefined, or accessor-backed.
 */
function serializeCanonicalJsonArray(value: readonly unknown[], ancestors: Set<object>): string {
  /** Canonical element texts collected in original array order. */
  const items: string[] = [];

  for (let index = 0; index < value.length; index += 1) {
    // Read an own descriptor instead of the indexed value so accessors cannot
    // execute during comparison. A missing descriptor identifies a sparse slot.
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (!descriptor) {
      throw new TypeError(`${invalidJsonValueMessage}: arrays must not be sparse.`);
    }

    // JSON arrays contain concrete data values; reject accessors and undefined
    // rather than invoking or coercing them to null.
    if (!("value" in descriptor)) {
      throw new TypeError(`${invalidJsonValueMessage}: array items must be data values.`);
    }
    if (descriptor.value === undefined) {
      throw new TypeError(`${invalidJsonValueMessage}: array items must be defined.`);
    }
    items.push(serializeCanonicalJsonValue(descriptor.value, ancestors));
  }

  // Joining already-canonical items avoids modifying the source array.
  return `[${items.join(",")}]`;
}

/**
 * Serializes a plain JSON object with lexicographically ordered member names.
 *
 * @param value Object to serialize.
 * @param ancestors Objects on the active traversal path.
 * @returns Deterministic JSON object text.
 * @throws {TypeError} When the object has a custom prototype or non-data member.
 */
function serializeCanonicalJsonObject(value: object, ancestors: Set<object>): string {
  // Only ordinary and null-prototype records belong to the JSON object model;
  // rejecting class instances prevents hidden runtime behavior during tests.
  const prototype: object | null = Object.getPrototypeOf(value) as object | null;
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${invalidJsonValueMessage}: objects must use a plain prototype.`);
  }

  // Capture descriptors once so special names remain own data properties and
  // accessor getters are never invoked as a side effect of comparison.
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === "symbol")) {
    throw new TypeError(`${invalidJsonValueMessage}: object member names must be strings.`);
  }
  const memberNames = Object.keys(value).sort(compareJsonMemberNames);
  const members: string[] = [];

  // A JSON object has no hidden own members. Reject non-enumerable data rather
  // than silently omitting state that could differ between compared values.
  if (memberNames.length !== ownKeys.length) {
    throw new TypeError(`${invalidJsonValueMessage}: object members must be enumerable.`);
  }

  for (const memberName of memberNames) {
    const descriptor = descriptors[memberName];
    if (!descriptor || !("value" in descriptor) || descriptor.value === undefined) {
      throw new TypeError(`${invalidJsonValueMessage}: object members must be data values.`);
    }

    // JSON.stringify safely escapes the exact member name, including prototype-
    // related names, while recursive serialization normalizes the member value.
    const serializedName = JSON.stringify(memberName);
    const serializedValue = serializeCanonicalJsonValue(descriptor.value, ancestors);
    members.push(`${serializedName}:${serializedValue}`);
  }

  // Emit members in sorted-name order without altering insertion order on the
  // source object used by the fixture or contract test.
  return `{${members.join(",")}}`;
}

/**
 * Orders JSON object member names by ECMAScript UTF-16 code-unit comparison.
 *
 * @param left First member name.
 * @param right Second member name.
 * @returns Negative, zero, or positive ordering result.
 */
function compareJsonMemberNames(left: string, right: string): number {
  // Explicit branches make the comparator independent from locale settings and
  // keep equal strings stable without allocating normalized copies.
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
