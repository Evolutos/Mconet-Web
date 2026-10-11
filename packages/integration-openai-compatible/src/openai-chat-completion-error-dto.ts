// Copyright © 2026 Mcont.

import type { Extensions } from "@evolutos/mconet-core-domain";

import {
  childPath,
  invalidProtocolResponse,
  requireObject,
  requireString,
  snapshotExtensions,
  unknownMembers,
} from "./wire.js";

/** Wire member that carries the service error description. */
const errorMessageMember = "message";

/** Wire member that carries the service error type. */
const errorTypeMember = "type";

/** Wire member that carries the service error code. */
const errorCodeMember = "code";

/** Members that belong to the frozen error shape and are not extensions. */
const knownErrorMembers: ReadonlySet<string> = new Set([
  errorMessageMember,
  errorTypeMember,
  errorCodeMember,
]);

/** Name used when construction failures identify this wire value. */
const errorOwner = "OpenAIChatCompletionErrorDTO";

/** Failure used when an integer code is outside the binary64 safe range. */
const jsonSafeIntegerMessage = "JSON integer must be within the interoperable safe range.";

/** Failure used when a numeric code would lose its sign in JSON. */
const jsonNegativeZeroMessage = "JSON number must not be negative zero.";

/** Expectation used when type is neither a string nor null. */
const nullableStringExpectation = "must be a string or null";

/** Expectation used when code is neither a string, an integer, nor null. */
const nullableCodeExpectation = "must be a string, an integer, or null";

/**
 * Optional error members. Absent and explicit null are the same stored state.
 *
 * The type stays module-private so this step publishes one wire value.
 */
interface OpenAIChatCompletionErrorOptions {
  /** Service error type, or omitted when the service sent nothing or null. */
  readonly errorType?: string;

  /** Service error code as sent, or omitted when the service sent nothing or null. */
  readonly code?: string | number;

  /** Response members outside the frozen error shape. */
  readonly extensions?: Extensions;
}

/**
 * Holds the decoded `error` object of a failure response body.
 *
 * `message` is service text. It is kept here only so the wire value is
 * complete; SDK errors never copy it. `errorType` and `code` may be absent or
 * null, and both cases are stored as omitted. Members outside the frozen
 * shape, such as `param`, are captured in `extensions`.
 */
export class OpenAIChatCompletionErrorDTO {
  /** Service-provided error description. */
  public readonly message: string;

  /**
   * Service error type when the service sent a string.
   *
   * Declared so an absent or null type is not an own undefined property.
   */
  declare public readonly errorType?: string;

  /**
   * Service error code when the service sent a string or integer.
   *
   * Declared so an absent or null code is not an own undefined property.
   */
  declare public readonly code?: string | number;

  /** Read-only error members outside the frozen shape. */
  public readonly extensions: Extensions;

  /**
   * Creates one error from a required message and optional type and code.
   *
   * @param message Service-provided error description.
   * @param options Optional type, code, and extension members.
   */
  public constructor(message: string, options: OpenAIChatCompletionErrorOptions = {}) {
    if (typeof message !== "string") {
      throw new TypeError(`${errorOwner} message must be a string.`);
    }
    if (!isPlainOptions(options)) {
      throw new TypeError(`${errorOwner} options must be an object.`);
    }

    const errorType = requireOptionalType(options.errorType);
    const code = requireOptionalCode(options.code);
    this.message = message;
    if (errorType !== undefined) {
      this.errorType = errorType;
    }
    if (code !== undefined) {
      this.code = code;
    }
    this.extensions = snapshotExtensions(options.extensions ?? {}, errorOwner);
    Object.freeze(this);
  }

  /**
   * Reads one decoded error object.
   *
   * @param value Decoded JSON for the error object.
   * @param path JSON Pointer of the error object, used only in failure messages.
   * @returns The error with any unknown members captured as extensions.
   */
  public static fromJson(value: unknown, path = ""): OpenAIChatCompletionErrorDTO {
    const document = requireObject(value, path);
    const message = requireString(document, errorMessageMember, path);
    const options: {
      errorType?: string;
      code?: string | number;
      extensions: Extensions;
    } = {
      extensions: unknownMembers(document, knownErrorMembers, errorOwner),
    };
    const errorType = readNullableString(document, errorTypeMember, path);
    const code = readNullableCode(document, errorCodeMember, path);
    if (errorType !== undefined) {
      options.errorType = errorType;
    }
    if (code !== undefined) {
      options.code = code;
    }
    return new OpenAIChatCompletionErrorDTO(message, options);
  }
}

/**
 * Returns whether the options bag is a plain object the constructor can read.
 *
 * @param value Candidate options value.
 * @returns Whether the value is an ordinary object.
 */
function isPlainOptions(value: unknown): value is object {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Returns one optional error type, or undefined when it is omitted.
 *
 * @param value Candidate type.
 * @returns The type string, or undefined.
 */
function requireOptionalType(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new TypeError(`${errorOwner} errorType must be a string or undefined.`);
  }
  return value;
}

/**
 * Returns one optional error code, or undefined when it is omitted.
 *
 * @param value Candidate code.
 * @returns The code string or safe integer, or undefined.
 */
function requireOptionalCode(value: unknown): string | number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  // Booleans and fractional numbers are different JSON kinds from integer codes.
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new TypeError(`${errorOwner} code must be a string, an integer, or undefined.`);
  }
  if (Object.is(value, -0)) {
    throw new RangeError(jsonNegativeZeroMessage);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(jsonSafeIntegerMessage);
  }
  return value;
}

/**
 * Reads a string member that may be absent or null.
 *
 * @param document Decoded object that owns the member.
 * @param name Member name.
 * @param path JSON Pointer of the object.
 * @returns The string, or undefined when the member is absent or null.
 */
function readNullableString(
  document: Readonly<Record<string, unknown>>,
  name: string,
  path: string,
): string | undefined {
  if (!Object.hasOwn(document, name)) {
    return undefined;
  }
  const descriptor = Object.getOwnPropertyDescriptor(document, name);
  const value = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
  if (value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw invalidProtocolResponse(childPath(path, name), nullableStringExpectation);
  }
  return value;
}

/**
 * Reads a string or integer member that may be absent or null.
 *
 * An unsafe integer is returned so construction can reject it as a numeric
 * range failure rather than as the wrong JSON kind.
 *
 * @param document Decoded object that owns the member.
 * @param name Member name.
 * @param path JSON Pointer of the object.
 * @returns The code, or undefined when the member is absent or null.
 */
function readNullableCode(
  document: Readonly<Record<string, unknown>>,
  name: string,
  path: string,
): string | number | undefined {
  if (!Object.hasOwn(document, name)) {
    return undefined;
  }
  const descriptor = Object.getOwnPropertyDescriptor(document, name);
  const value = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
  if (value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isInteger(value) && !Object.is(value, -0)) {
    return value;
  }
  throw invalidProtocolResponse(childPath(path, name), nullableCodeExpectation);
}
