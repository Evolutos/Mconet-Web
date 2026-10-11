// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type { CodecContext, ErasedRuntimeValue, PayloadDecoder } from "@evolutos/mconet-core-spi";

import { collectBoundedBytes } from "./collect-bounded-bytes.js";
import { jsonSuccessPayloadDecoderDescriptor } from "./json-success-payload-decoder-descriptor.js";

/** Semantic identity of a decoded JSON value. It does not name a model protocol. */
const JSON_VALUE_TYPE_ID = "json.value";

/** Stable code for JSON or UTF-8 text that cannot be decoded. */
const DESERIALIZATION_ERROR_CODE = "deserialization";

/** Stable code for decoding stopped by the interaction signal. */
const CANCELLED_ERROR_CODE = "cancelled";

/** Stable code for a body limit that is not a positive safe integer. */
const INVALID_BODY_LIMIT_CODE = "invalid_component_configuration";

/**
 * Decodes one bounded UTF-8 JSON body into an erased JSON value.
 *
 * The decoder accepts any JSON value, including null and empty containers. It
 * does not interpret task or provider error semantics, choose a component, or
 * retain the source bytes in a failure. Non-finite numbers and negative zero
 * are rejected because JSON text would not preserve them.
 */
export class JsonSuccessPayloadDecoder implements PayloadDecoder {
  /** Shared descriptor, including the success payload port. */
  public readonly descriptor = jsonSuccessPayloadDecoderDescriptor;

  /** Positive safe-integer limit applied before the body is parsed. */
  readonly #maxBodyBytes: number;

  /**
   * Creates a decoder that refuses bodies larger than `maxBodyBytes`.
   *
   * @param maxBodyBytes Maximum accepted UTF-8 body length as a positive safe integer.
   * @throws {ModelInteractionError} When `maxBodyBytes` cannot enforce a finite limit.
   */
  public constructor(maxBodyBytes: number) {
    // Fail at construction so a later decode cannot treat a bad limit as malformed JSON.
    if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes <= 0) {
      throw createInvalidBodyLimitError();
    }
    this.#maxBodyBytes = maxBodyBytes;
  }

  /**
   * Decodes one complete response body into a JSON value.
   *
   * @param bytes Caller-owned response bytes. They are measured and copied only when they fit.
   * @param context Cancellation signal for this codec operation.
   * @returns Erased JSON value. No schema identity is invented for the protocol payload.
   * @throws {ModelInteractionError} When decoding is cancelled, the body is too large, or the text is not JSON.
   */
  public async decode(bytes: Uint8Array, context: CodecContext): Promise<ErasedRuntimeValue> {
    // Cancellation wins over the size and JSON checks so an aborted interaction
    // does not surface a deserialization failure.
    if (context.signal.aborted) {
      throw createCancelledDecodingError();
    }

    const boundedBytes = collectBoundedBytes([bytes], this.#maxBodyBytes);
    const jsonText = decodeUtf8(boundedBytes);
    const value = parseJsonValue(jsonText);
    return { typeId: JSON_VALUE_TYPE_ID, value };
  }
}

/**
 * Decodes UTF-8 bytes without replacing invalid sequences.
 *
 * @param bytes Bounded bytes already accepted by the collector.
 * @returns Unicode text for those bytes.
 * @throws {ModelInteractionError} When the bytes are not valid UTF-8.
 */
function decodeUtf8(bytes: Uint8Array): string {
  try {
    // Fatal mode rejects ill-formed UTF-8 instead of inserting a replacement
    // character that would change the JSON text.
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw createDeserializationError();
  }
}

/**
 * Parses JSON text and rejects numbers JSON cannot round-trip.
 *
 * @param jsonText UTF-8 text from the bounded body.
 * @returns Parsed JSON value.
 * @throws {ModelInteractionError} When the text is not JSON or contains a non-portable number.
 */
function parseJsonValue(jsonText: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText) as unknown;
  } catch {
    // The parser message can quote the source text, so it is not attached.
    throw createDeserializationError();
  }

  assertPortableJsonValue(parsed);
  return parsed;
}

/**
 * Rejects decoded numbers whose meaning would change when encoded again.
 *
 * @param value Parsed JSON value or one of its nested members.
 * @throws {ModelInteractionError} When a number is non-finite or negative zero.
 */
function assertPortableJsonValue(value: unknown): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return;
  }

  if (typeof value === "number") {
    // JSON.parse can produce Infinity for an overflowing literal and negative
    // zero for "-0". Neither is a portable JSON number.
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw createDeserializationError();
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      assertPortableJsonValue(item);
    }
    return;
  }

  if (!isDecodedJsonObject(value)) {
    throw createDeserializationError();
  }

  for (const nested of Object.values(value)) {
    assertPortableJsonValue(nested);
  }
}

/**
 * Narrows one decoded value to a plain JSON object.
 *
 * @param value Parsed value that is not a primitive or array.
 * @returns Whether the value is a string-keyed JSON object.
 */
function isDecodedJsonObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  // JSON.parse normally uses Object.prototype. A null prototype is still a
  // dictionary and cannot carry provider behavior.
  return prototype === Object.prototype || prototype === null;
}

/**
 * Creates the failure for JSON or UTF-8 text that cannot be decoded.
 *
 * @returns Deserialization error without response text or bytes.
 */
function createDeserializationError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "JSON response body cannot be decoded.",
    category: "deserialization",
    phase: "decoding",
    code: DESERIALIZATION_ERROR_CODE,
    diagnostics: [],
  });
}

/**
 * Creates the failure for one cancelled decode.
 *
 * @returns Cancellation error without response bytes.
 */
function createCancelledDecodingError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "JSON response decoding was cancelled.",
    category: "cancelled",
    phase: "decoding",
    code: CANCELLED_ERROR_CODE,
    diagnostics: [],
  });
}

/**
 * Creates the failure for a body limit that cannot be enforced.
 *
 * @returns Configuration error without the rejected limit value.
 */
function createInvalidBodyLimitError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Response body byte limit must be a positive safe integer.",
    category: "invalid_component_configuration",
    phase: "decoding",
    code: INVALID_BODY_LIMIT_CODE,
    diagnostics: [],
  });
}
