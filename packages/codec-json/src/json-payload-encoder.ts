// Copyright © 2026 Mcont.

import {
  ModelInteractionError,
  isOpenIdentifier,
  type OpenIdentifier,
} from "@evolutos/mconet-core-domain";
import type {
  CodecContext,
  ComponentDescriptor,
  ErasedRuntimeValue,
  PayloadEncoder,
  TransportBody,
} from "@evolutos/mconet-core-spi";

import { encodeUtf8 } from "./encode-utf8.js";

/** Diagnostic component name. It is not a registry key or selection identity. */
const JSON_PAYLOAD_ENCODER_NAME = "json-payload-encoder";

/** Descriptive implementation version. It is not the package version. */
const JSON_PAYLOAD_ENCODER_VERSION = "1.0.0";

/** Stable code for a payload that cannot be represented as JSON text. */
const SERIALIZATION_ERROR_CODE = "serialization";

/** Stable code for encoding stopped by the interaction signal. */
const CANCELLED_ERROR_CODE = "cancelled";

/**
 * Capability set required by the component descriptor.
 *
 * This encoder declares no capability yet. The set is shared and empty so
 * instances cannot grow independent capability claims.
 */
const encoderCapabilities: ReadonlySet<OpenIdentifier> = new Set();

/**
 * Encodes one JSON payload value into a buffered UTF-8 transport body.
 *
 * Only `value` is serialized. `typeId` and `schemaId` stay port metadata and
 * are not written into the body. The encoder does not read tasks, service
 * access, credentials, or authorization, and it does not choose a media type
 * or another component. Non-finite numbers, negative zero, undefined, sparse
 * arrays, cycles, and non-plain objects fail before any text is produced.
 */
export class JsonPayloadEncoder implements PayloadEncoder {
  /** Minimum descriptor required by the runtime component contract. */
  public readonly descriptor: ComponentDescriptor = {
    name: JSON_PAYLOAD_ENCODER_NAME,
    version: JSON_PAYLOAD_ENCODER_VERSION,
    capabilities: encoderCapabilities,
    source: "builtin",
  };

  /**
   * Serializes the payload value and returns caller-owned UTF-8 bytes.
   *
   * @param value Erased payload whose JSON value is the only encoded data.
   * @param context Cancellation signal for this codec operation.
   * @returns Buffered byte body containing the JSON text.
   * @throws {ModelInteractionError} When encoding is cancelled or the payload is not serializable JSON.
   */
  public async encode(value: ErasedRuntimeValue, context: CodecContext): Promise<TransportBody> {
    // Cancellation wins over validation so an aborted interaction does not
    // report a serialization failure for a payload it must not encode.
    if (context.signal.aborted) {
      throw createCancelledEncodingError();
    }

    assertJsonPayloadEnvelope(value);
    const jsonText = serializeJsonValue(value.value);

    return {
      kind: "bytes",
      bytes: encodeUtf8(jsonText),
    };
  }
}

/**
 * Checks the payload port fields without copying or encoding them.
 *
 * @param value Erased runtime value supplied to the encoder.
 * @throws {ModelInteractionError} When the type or schema identity is unusable.
 */
function assertJsonPayloadEnvelope(value: ErasedRuntimeValue): void {
  // The semantic identity must already be a well-formed open identifier. A
  // schema identity may be absent, but a present one must be a string.
  if (!isOpenIdentifier(value.typeId)) {
    throw createSerializationError();
  }
  if (value.schemaId !== undefined && typeof value.schemaId !== "string") {
    throw createSerializationError();
  }
}

/**
 * Converts one JSON value to JSON text without reordering object members.
 *
 * The function rejects values whose JSON representation would drop, replace, or
 * change their meaning.
 *
 * @param value Payload value to serialize.
 * @returns JSON text for `value`.
 * @throws {ModelInteractionError} When `value` is not finite, plain JSON data.
 */
function serializeJsonValue(value: unknown): string {
  assertJsonValue(value, new WeakSet());

  let jsonText: string | undefined;
  try {
    // The walk above rejected every value JSON.stringify would coerce, so this
    // call only renders text and preserves source member order.
    jsonText = JSON.stringify(value);
  } catch {
    // A host serialization failure still becomes the same content-safe error.
    throw createSerializationError();
  }

  // JSON.stringify returns undefined only for a top-level value the walk should
  // already have rejected. Keep the check so that host result cannot escape.
  if (typeof jsonText !== "string") {
    throw createSerializationError();
  }

  return jsonText;
}

/**
 * Rejects values that are not finite plain JSON data.
 *
 * @param value Candidate JSON value or nested member.
 * @param seen Objects currently on the walk, used only to detect cycles.
 * @throws {ModelInteractionError} When the candidate cannot be serialized unchanged.
 */
function assertJsonValue(value: unknown, seen: WeakSet<object>): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return;
  }

  if (typeof value === "number") {
    // Non-finite numbers become null in JSON, and negative zero becomes zero.
    // Both changes lose the caller's value, so they fail closed.
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw createSerializationError();
    }
    return;
  }

  if (typeof value !== "object") {
    // Undefined, bigint, functions, and symbols have no JSON representation.
    throw createSerializationError();
  }

  if (seen.has(value)) {
    throw createSerializationError();
  }
  seen.add(value);

  if (Array.isArray(value)) {
    // A hole is not an explicit null. JSON rendering would hide that difference.
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) {
        throw createSerializationError();
      }
      assertJsonValue(value[index], seen);
    }
    seen.delete(value);
    return;
  }

  if (!isPlainJsonObject(value)) {
    throw createSerializationError();
  }

  // Own string keys keep source order. Undefined members are present to the
  // walk and must fail instead of being omitted.
  for (const key of Object.keys(value)) {
    assertJsonValue(value[key], seen);
  }
  seen.delete(value);
}

/**
 * Determines whether a non-null object is a plain JSON object.
 *
 * @param value Object that is not an array.
 * @returns Whether JSON object enumeration can represent the value unchanged.
 */
function isPlainJsonObject(value: object): value is Record<string, unknown> {
  const prototype: unknown = Object.getPrototypeOf(value);
  // Dictionary objects and normal object literals are JSON objects. Class
  // instances, dates, maps, and typed arrays are not.
  return prototype === Object.prototype || prototype === null;
}

/**
 * Creates the content-safe failure for one non-serializable payload.
 *
 * @returns Serialization error without payload contents or port identifiers.
 */
function createSerializationError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "JSON payload cannot be serialized.",
    category: "serialization",
    phase: "encoding",
    code: SERIALIZATION_ERROR_CODE,
    diagnostics: [],
  });
}

/**
 * Creates the content-safe failure for one cancelled encoding operation.
 *
 * @returns Cancellation error that does not include payload contents.
 */
function createCancelledEncodingError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "JSON payload encoding was cancelled.",
    category: "cancelled",
    phase: "encoding",
    code: CANCELLED_ERROR_CODE,
    diagnostics: [],
  });
}
