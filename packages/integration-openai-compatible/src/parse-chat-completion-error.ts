// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type { ErasedRuntimeValue, TransportResponseMetadata } from "@evolutos/mconet-core-spi";

import { mapAuthenticationError } from "./map-authentication-error.js";
import { mapContentFilterError } from "./map-content-filter-error.js";
import { mapGenericServiceError } from "./map-generic-service-error.js";
import { mapRateLimitError } from "./map-rate-limit-error.js";
import { OpenAIChatCompletionErrorDTO } from "./openai-chat-completion-error-dto.js";

/**
 * Payload identity of a decoded chat-completions error value.
 *
 * The JSON decoder reports `json.value` instead, and that identity is accepted
 * as the same decoded body.
 */
export const OPENAI_CHAT_ERROR_TYPE_ID = "protocol.openai.chat-error";

/** Identity produced by the JSON payload decoder for a decoded body. */
const jsonValueTypeId = "json.value";

/** Member that wraps the OpenAI error object. */
const errorEnvelopeMember = "error";

/** Stable code when the payload is not an error value. */
const invalidErrorTypeCode = "invalid_error_type";

/** Stable code when no defined branch classified a readable error. */
const unclassifiedErrorCode = "unclassified_service_error";

/** Phase of a failure read from a service response. */
const responseParsingPhase = "response_parsing";

/**
 * Dispatches one decoded chat-completions error to a defined branch.
 *
 * The order is fixed: authentication (401/403), rate limit (429), content
 * policy, then the generic service branch. No other classifier runs. A success
 * body is not parsed as a conversation result. The service message is not copied.
 *
 * @param input Decoded payload and the transport metadata that selected it.
 * @returns The classified interaction error.
 */
export function parseOpenAIChatCompletionError(input: {
  readonly payload: ErasedRuntimeValue;
  readonly metadata: TransportResponseMetadata;
}): ModelInteractionError {
  if (!isErrorPayload(input.payload)) {
    return failure(
      invalidErrorTypeCode,
      "protocol",
      "Payload is not a chat completion error value.",
    );
  }

  let error: OpenAIChatCompletionErrorDTO;
  try {
    error = readError(input.payload.value);
  } catch (caught) {
    if (caught instanceof ModelInteractionError) {
      // Wire reading already uses a fixed message. Do not replace it with the body.
      return caught;
    }
    return failure(
      "invalid_error_payload",
      "protocol",
      "Chat completion error payload is not usable.",
    );
  }

  const statusCode = input.metadata?.statusCode;
  const requestId = input.metadata?.requestId;
  const identified = {
    error,
    ...(requestId === undefined ? {} : { requestId }),
  };
  // Status branches run before the policy branch so 401, 403, and 429 stay
  // with the status even when the body also names a policy. Optional status is
  // omitted for branches that treat absence as "no property".
  const withStatus = {
    ...identified,
    ...(statusCode === undefined ? {} : { statusCode }),
  };
  const classified =
    mapAuthenticationError({ ...identified, statusCode }) ??
    mapRateLimitError({
      ...identified,
      statusCode,
      ...(input.metadata?.headers === undefined ? {} : { headers: input.metadata.headers }),
    }) ??
    mapContentFilterError(withStatus) ??
    mapGenericServiceError(withStatus);
  return (
    classified ??
    failure(unclassifiedErrorCode, "unknown", "No service-error branch classified the response.")
  );
}

/**
 * Returns whether the payload is a decoded error body this dispatcher can read.
 *
 * @param payload Runtime payload envelope.
 * @returns Whether the type id is the JSON decoder id, the chat error id, or the value is already parsed.
 */
function isErrorPayload(payload: ErasedRuntimeValue | undefined): payload is ErasedRuntimeValue {
  if (payload?.value instanceof OpenAIChatCompletionErrorDTO) {
    return true;
  }
  return payload?.typeId === jsonValueTypeId || payload?.typeId === OPENAI_CHAT_ERROR_TYPE_ID;
}

/**
 * Returns the error object inside a decoded body.
 *
 * @param value Payload value.
 * @returns The parsed error object.
 */
function readError(value: unknown): OpenAIChatCompletionErrorDTO {
  if (value instanceof OpenAIChatCompletionErrorDTO) {
    return value;
  }
  const envelope = errorObject(value);
  if (envelope !== undefined) {
    // The standard failure body nests the error. The wrapper itself is not the error.
    return OpenAIChatCompletionErrorDTO.fromJson(envelope);
  }
  return OpenAIChatCompletionErrorDTO.fromJson(value);
}

/**
 * Returns the nested error object when the body is an error envelope.
 *
 * @param value Candidate decoded body.
 * @returns The nested object, or `undefined` when the body is not an envelope.
 */
function errorObject(value: unknown): unknown {
  if (!isPlainObject(value) || !Object.hasOwn(value, errorEnvelopeMember)) {
    return undefined;
  }
  const nested: unknown = value[errorEnvelopeMember];
  return isPlainObject(nested) ? nested : undefined;
}

/**
 * Returns whether a value is a plain object.
 *
 * @param value Candidate value.
 * @returns Whether the value is an ordinary object.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Returns one dispatcher failure that contains no service body text.
 *
 * @param code Stable error code.
 * @param category High-level classification.
 * @param message Fixed technical summary.
 * @returns The interaction error.
 */
function failure(
  code: string,
  category: "protocol" | "unknown",
  message: string,
): ModelInteractionError {
  return new ModelInteractionError({
    message,
    category,
    phase: responseParsingPhase,
    code,
    diagnostics: [
      {
        code,
        severity: "error",
        phase: responseParsingPhase,
        message,
      },
    ],
  });
}
