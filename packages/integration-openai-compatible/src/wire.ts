// Copyright © 2026 Mcont.

import {
  ModelInteractionError,
  type Extensions,
  type JsonValue,
} from "@evolutos/mconet-core-domain";

/** Stable code for a decoded payload that violates the frozen wire shape. */
const invalidProtocolResponseCode = "invalid_protocol_response";

/** Prefix that names the protocol without copying the rejected value. */
const protocolFieldMessagePrefix = "OpenAI-compatible response field";

/** Expectation used when a wire location is not a JSON object. */
const objectExpectation = "must be an object";

/** Expectation used when a required wire member is not a JSON string. */
const stringExpectation = "must be a string";

/** Failure used when a nested extension value is not portable JSON. */
const jsonStructureMessage = "value must be a structurally valid JsonValue.";

/** Failure used when an extension number cannot survive JSON encoding. */
const jsonFiniteNumberMessage = "JSON floating-point value must be finite.";

/** Failure used when an extension number would lose its sign in JSON. */
const jsonNegativeZeroMessage = "JSON number must not be negative zero.";

/** Shared empty extension snapshot. It is frozen so callers cannot add members. */
const emptyExtensions: Extensions = Object.freeze({});

/**
 * Creates the normalized failure for one wire field that has the wrong shape.
 *
 * Only the location and rule enter the message. Service text can echo request
 * content, so the observed value is never copied.
 *
 * @param path JSON Pointer of the offending field. The root is an empty string.
 * @param expectation Short statement of the frozen wire rule that failed.
 * @returns A protocol error whose message names the location but never the value.
 */
export function invalidProtocolResponse(path: string, expectation: string): ModelInteractionError {
  // The root pointer is `/` so a failure at the document root still has a location.
  const location = path === "" ? "/" : path;
  return new ModelInteractionError({
    message: `${protocolFieldMessagePrefix} ${location} ${expectation}.`,
    category: "protocol",
    phase: "response_parsing",
    code: invalidProtocolResponseCode,
    diagnostics: [],
  });
}

/**
 * Appends one object member to a JSON Pointer.
 *
 * RFC 6901 escaping keeps member names containing `/` or `~` unambiguous.
 *
 * @param path JSON Pointer of the parent. The root is an empty string.
 * @param name Object member name to append.
 * @returns The child pointer.
 */
export function childPath(path: string, name: string): string {
  // Escape `~` before `/` so an already escaped token is not escaped twice.
  const token = name.replaceAll("~", "~0").replaceAll("/", "~1");
  return `${path}/${token}`;
}

/**
 * Returns whether a value is an ordinary object rather than an array or host object.
 *
 * @param value Candidate extension or decoded JSON value.
 * @returns Whether the value has a plain object prototype.
 */
function isPlainRecord(value: unknown): value is object {
  // Arrays and host objects are different JSON kinds even though they are objects.
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Returns whether every own property is an enumerable string data property.
 *
 * Accessors are rejected without being invoked so a decoded payload cannot run
 * caller code while its shape is checked.
 *
 * @param value Plain object to inspect.
 * @returns Whether the object matches a decoded JSON object.
 */
function isDecodedJsonObject(value: object): value is Record<string, unknown> {
  for (const key of Reflect.ownKeys(value)) {
    // JSON object keys are strings. A symbol cannot appear in a decoded payload.
    if (typeof key !== "string") {
      return false;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      return false;
    }
  }
  return true;
}

/**
 * Returns a decoded JSON object or rejects any other value.
 *
 * @param value Candidate decoded JSON value.
 * @param path JSON Pointer of the value.
 * @returns The same object after its shape has been checked.
 */
export function requireObject(value: unknown, path: string): Readonly<Record<string, unknown>> {
  // A class instance, array, or accessor-bearing object is not a decoded JSON object.
  if (!isPlainRecord(value) || !isDecodedJsonObject(value)) {
    throw invalidProtocolResponse(path, objectExpectation);
  }
  return value;
}

/**
 * Returns one required, non-null string member.
 *
 * A missing member and an explicit null both fail: the frozen profile marks
 * these fields required and not nullable.
 *
 * @param document Decoded object that owns the member.
 * @param name Member name.
 * @param path JSON Pointer of the object.
 * @returns The member text.
 */
export function requireString(
  document: Readonly<Record<string, unknown>>,
  name: string,
  path: string,
): string {
  const descriptor = Object.getOwnPropertyDescriptor(document, name);
  // Read the stored value without invoking an accessor. A missing member, null,
  // or any non-string uses the same rule so the message cannot reveal the value.
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    descriptor.enumerable !== true ||
    typeof descriptor.value !== "string"
  ) {
    throw invalidProtocolResponse(childPath(path, name), stringExpectation);
  }
  return descriptor.value;
}

/**
 * Copies one portable JSON value so later caller mutation cannot change it.
 *
 * @param value Candidate JSON value.
 * @param ancestors Objects currently being copied, used to reject cycles.
 * @returns A detached JSON value.
 */
function copyJsonValue(value: unknown, ancestors: Set<object>): JsonValue {
  // Preserve JSON scalars exactly. Finite numbers exclude NaN and infinities,
  // and negative zero is rejected because JSON encoding loses its sign.
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RangeError(jsonFiniteNumberMessage);
    }
    if (Object.is(value, -0)) {
      throw new RangeError(jsonNegativeZeroMessage);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return copyJsonArray(value, ancestors);
  }
  if (isPlainRecord(value)) {
    return copyJsonRecord(value, ancestors);
  }
  throw new TypeError(jsonStructureMessage);
}

/**
 * Copies a dense ordinary array as an ordered JSON value collection.
 *
 * @param value Candidate array.
 * @param ancestors Objects currently being copied.
 * @returns A frozen detached array.
 */
function copyJsonArray(value: readonly unknown[], ancestors: Set<object>): readonly JsonValue[] {
  const prototype: unknown = Object.getPrototypeOf(value);
  const keys = Reflect.ownKeys(value);
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  const length = lengthDescriptor?.value;
  // Reject subclasses, holes, extra properties, and cycles before reading elements.
  if (
    prototype !== Array.prototype ||
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    typeof length !== "number" ||
    lengthDescriptor.enumerable !== false ||
    keys.length !== length + 1 ||
    ancestors.has(value)
  ) {
    throw new TypeError(jsonStructureMessage);
  }

  ancestors.add(value);
  try {
    const copy: JsonValue[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
        throw new TypeError(jsonStructureMessage);
      }
      copy.push(copyJsonValue(descriptor.value, ancestors));
    }
    return Object.freeze(copy);
  } finally {
    // Remove the current array so a repeated sibling reference remains valid.
    ancestors.delete(value);
  }
}

/**
 * Copies a plain object as a string-keyed JSON record.
 *
 * @param value Candidate record.
 * @param ancestors Objects currently being copied.
 * @returns A frozen detached record.
 */
function copyJsonRecord(value: object, ancestors: Set<object>): Extensions {
  const prototype: unknown = Object.getPrototypeOf(value);
  if ((prototype !== Object.prototype && prototype !== null) || ancestors.has(value)) {
    throw new TypeError(jsonStructureMessage);
  }

  ancestors.add(value);
  try {
    const copy: Record<string, JsonValue> = {};
    for (const key of Reflect.ownKeys(value)) {
      // Nested keys are part of the value shape, not the top-level extension map.
      if (typeof key !== "string") {
        throw new TypeError(jsonStructureMessage);
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
        throw new TypeError(jsonStructureMessage);
      }
      // Define the property so a key such as `__proto__` stays an own data member.
      Object.defineProperty(copy, key, {
        configurable: true,
        enumerable: true,
        value: copyJsonValue(descriptor.value, ancestors),
        writable: true,
      });
    }
    return Object.freeze(copy);
  } finally {
    ancestors.delete(value);
  }
}

/**
 * Captures members outside the frozen shape as a read-only snapshot.
 *
 * The response profile ignores unknown members after capture, so they are
 * preserved here and never interpreted. Member order follows the decoded object.
 *
 * @param document Decoded object whose extra members should be captured.
 * @param known Member names that belong to the frozen shape.
 * @param owner Wire value that will own the captured snapshot.
 * @returns A frozen extension snapshot, shared when no unknown members exist.
 */
export function unknownMembers(
  document: Readonly<Record<string, unknown>>,
  known: ReadonlySet<string>,
  owner: string,
): Extensions {
  const captured: Record<string, unknown> = {};
  let hasUnknownMember = false;
  for (const name of Object.keys(document)) {
    // Known members stay in their typed fields and are never also extensions.
    if (known.has(name)) {
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(document, name);
    if (descriptor === undefined || !("value" in descriptor)) {
      continue;
    }
    Object.defineProperty(captured, name, {
      configurable: true,
      enumerable: true,
      value: descriptor.value,
      writable: true,
    });
    hasUnknownMember = true;
  }
  if (!hasUnknownMember) {
    return emptyExtensions;
  }
  return snapshotExtensions(captured, owner);
}

/**
 * Validates and freezes string-keyed portable JSON extension members.
 *
 * @param value Caller-supplied extension mapping.
 * @param owner Wire value that owns the snapshot, used in failure messages.
 * @returns A frozen snapshot detached from the caller's object.
 */
export function snapshotExtensions(value: unknown, owner: string): Extensions {
  // Arrays, host objects, and primitives are not extension mappings.
  if (!isPlainRecord(value)) {
    throw new TypeError(`${owner} extensions must be a mapping.`);
  }

  const keys = Reflect.ownKeys(value);
  for (const key of keys) {
    // JSON object keys are strings. Symbol keys cannot travel in the wire value.
    if (typeof key !== "string") {
      throw new TypeError(`${owner} extensions keys must be strings.`);
    }
  }
  if (keys.length === 0) {
    return emptyExtensions;
  }
  return copyJsonRecord(value, new Set<object>());
}
