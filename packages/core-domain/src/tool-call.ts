// Copyright © 2026 Mcont.

import type { JsonValue } from "./json-value.js";
import { isJsonRecord } from "./model-descriptor.js";
import { isOpenIdentifier } from "./open-identifier.js";

/**
 * One function the model may ask the application to run.
 *
 * The declaration is protocol-neutral. `parameters` keeps a JSON Schema object
 * without interpreting it. This value does not carry an implementation.
 */
export interface ToolDeclaration {
  /** Function name the model uses when it asks for this tool. */
  readonly name: string;

  /** Optional guidance shown to the model. Omission leaves the member absent. */
  readonly description?: string;

  /** JSON Schema object describing the function arguments. */
  readonly parameters: JsonValue;
}

/**
 * One function call requested by an assistant turn or answered by a tool turn.
 *
 * `arguments` keeps the model's raw JSON text. The domain does not parse it,
 * repair it, or execute it.
 */
export interface ToolCall {
  /** Call identity that a later tool result must repeat. */
  readonly id: string;

  /** Declared function name selected by the model. */
  readonly name: string;

  /** Raw JSON argument text, preserved exactly. */
  readonly arguments: string;
}

/**
 * Accepts a missing tool-call id, or one stored open identifier.
 *
 * @param descriptor Property descriptor for `toolCallId`, when the field exists.
 * @returns Whether the field is absent or a usable call id.
 */
export function isAbsentOrToolCallId(descriptor: PropertyDescriptor | undefined): boolean {
  // No descriptor means the member was omitted, which is valid.
  if (descriptor === undefined) {
    return true;
  }
  // Explicit undefined is not omission, and an accessor is not a stored id.
  // The stored value must be a non-empty open identifier.
  return isDataDescriptor(descriptor) && isOpenIdentifier(descriptor.value);
}

/**
 * Accepts a missing tool-call list, or one non-empty list of distinct calls.
 *
 * @param descriptor Property descriptor for `toolCalls`, when the field exists.
 * @returns Whether the field is absent or a usable call list.
 */
export function isAbsentOrToolCalls(descriptor: PropertyDescriptor | undefined): boolean {
  // Omission means this entry requested no tools.
  if (descriptor === undefined) {
    return true;
  }
  // An accessor or an explicit undefined is not a stored list.
  if (!isDataDescriptor(descriptor)) {
    return false;
  }
  // An empty list is not the same fact as omission, and holes or accessors
  // cannot hide a call.
  const calls = readDenseValues(descriptor.value);
  if (calls === undefined || calls.length === 0) {
    return false;
  }
  // Each call must be well formed, and each id can be answered only once.
  const ids = new Set<string>();
  for (const call of calls) {
    if (!isToolCall(call) || ids.has(call.id)) {
      return false;
    }
    ids.add(call.id);
  }
  return true;
}

/**
 * Accepts a missing declaration list, or one non-empty list of distinct tools.
 *
 * @param descriptor Property descriptor for `tools`, when the field exists.
 * @returns Whether the field is absent or a usable declaration list.
 */
export function isAbsentOrToolDeclarations(descriptor: PropertyDescriptor | undefined): boolean {
  // Omission means this conversation input declares no functions.
  if (descriptor === undefined) {
    return true;
  }
  if (!isDataDescriptor(descriptor)) {
    return false;
  }
  // An empty list must be omitted by the caller. A sparse array is rejected.
  const tools = readDenseValues(descriptor.value);
  if (tools === undefined || tools.length === 0) {
    return false;
  }
  // Names are the identity the model uses, so a repeated name is ambiguous.
  const names = new Set<string>();
  for (const tool of tools) {
    if (!isToolDeclaration(tool) || names.has(tool.name)) {
      return false;
    }
    names.add(tool.name);
  }
  return true;
}

/**
 * Determines whether an unknown value is one function declaration.
 *
 * @param value Untrusted declaration.
 * @returns Whether the value satisfies {@link ToolDeclaration}.
 */
export function isToolDeclaration(value: unknown): value is ToolDeclaration {
  // Declarations are plain records. Arrays, accessors, and exotic prototypes
  // are not function metadata.
  const descriptors = readRecord(value);
  if (descriptors === undefined) {
    return false;
  }
  const name = descriptors.name;
  const parameters = descriptors.parameters;
  // The name is the model's selection key. Description may be omitted, but a
  // present one must be stored text. Parameters stay an uninterpreted JSON object.
  return (
    isDataDescriptor(name) &&
    isOpenIdentifier(name.value) &&
    isAbsentOrString(descriptors.description) &&
    isDataDescriptor(parameters) &&
    isJsonRecord(parameters.value, new Set<object>())
  );
}

/**
 * Determines whether an unknown value is one function call.
 *
 * @param value Untrusted call.
 * @returns Whether the value satisfies {@link ToolCall}.
 */
export function isToolCall(value: unknown): value is ToolCall {
  const descriptors = readRecord(value);
  if (descriptors === undefined) {
    return false;
  }
  const id = descriptors.id;
  const name = descriptors.name;
  const callArguments = descriptors.arguments;
  // The id links a later tool result to this request. Arguments stay raw text:
  // invalid JSON is still the model's text and is not repaired here.
  return (
    isDataDescriptor(id) &&
    isOpenIdentifier(id.value) &&
    isDataDescriptor(name) &&
    isOpenIdentifier(name.value) &&
    isDataDescriptor(callArguments) &&
    typeof callArguments.value === "string"
  );
}

/** Checks that a property descriptor stores a value rather than an accessor. */
function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { readonly value: unknown } {
  // `"value" in descriptor` is false for a getter/setter pair, so those are
  // rejected without invoking them.
  return descriptor !== undefined && "value" in descriptor;
}

/** Validates true absence or an own string data property. */
function isAbsentOrString(descriptor: PropertyDescriptor | undefined): boolean {
  // Omission is valid for an optional string. A present value must be stored
  // text, including the empty string; an accessor is not text.
  return (
    descriptor === undefined ||
    (isDataDescriptor(descriptor) && typeof descriptor.value === "string")
  );
}

/** Reads an ordinary record without invoking accessors. */
function readRecord(value: unknown): Record<string, PropertyDescriptor> | undefined {
  // Primitives and arrays are not declaration or call records.
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  try {
    // Only an ordinary object or a null-prototype record is accepted. Reading
    // descriptors avoids calling a getter on an untrusted object.
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return undefined;
    }
    return Object.getOwnPropertyDescriptors(value);
  } catch {
    // A proxy or revoked object that throws is not a valid record.
    return undefined;
  }
}

/**
 * Returns the stored values of a dense ordinary array.
 *
 * Holes, accessors, and extra own properties fail closed, matching the message
 * entry collection rule.
 *
 * @param value Candidate array.
 * @returns Stored item values, or undefined when the collection is not dense.
 */
function readDenseValues(value: unknown): readonly unknown[] | undefined {
  try {
    // A subclassed array can change enumeration, so only Array.prototype is accepted.
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return undefined;
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    const keys = Reflect.ownKeys(value);
    // Own keys must be exactly length plus the indexes 0..length-1. Any hole,
    // extra property, or symbol key fails that count.
    if (
      !isDataDescriptor(lengthDescriptor) ||
      typeof lengthDescriptor.value !== "number" ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      keys.length !== lengthDescriptor.value + 1
    ) {
      return undefined;
    }
    const items: unknown[] = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      // A non-enumerable slot or a getter would hide a value from a normal copy.
      if (!isDataDescriptor(descriptor) || descriptor.enumerable !== true) {
        return undefined;
      }
      items.push(descriptor.value);
    }
    return items;
  } catch {
    return undefined;
  }
}
