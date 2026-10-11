// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

import { OpenAIChatCompletionErrorDTO } from "./openai-chat-completion-error-dto.js";

/** HTTP status that means the credential was rejected. */
const unauthorizedStatus = 401;

/** HTTP status that means the credential is not allowed to perform the call. */
const forbiddenStatus = 403;

/** Stable code for a rejected credential. */
const authenticationFailedCode = "service_authentication_failed";

/** Stable code for a credential that lacks permission. */
const permissionDeniedCode = "service_permission_denied";

/** Phase of a failure read from a service response. */
const responseParsingPhase = "response_parsing";

/**
 * Maps an HTTP 401 or 403 chat-completions error onto a standard interaction error.
 *
 * 401 is authentication and 403 is permission. Any other status is not this
 * branch and returns `undefined` so a later branch can classify it. The service
 * `message` is not copied. The service `code` is kept as `serviceErrorCode`
 * when the service sent one.
 *
 * @param input Status, decoded error object, and optional request id.
 * @returns The classified error, or `undefined` when the status is not 401 or 403.
 */
export function mapAuthenticationError(input: {
  readonly statusCode: number | undefined;
  readonly error: OpenAIChatCompletionErrorDTO;
  readonly requestId?: string;
}): ModelInteractionError | undefined {
  if (!(input.error instanceof OpenAIChatCompletionErrorDTO)) {
    throw new TypeError("Authentication mapping requires an OpenAIChatCompletionErrorDTO.");
  }

  const classification = classificationForStatus(input.statusCode);
  if (classification === undefined) {
    // Leave 429, 5xx, and unknown statuses for their own branches.
    return undefined;
  }

  const serviceErrorCode = serviceCodeText(input.error.code);
  return new ModelInteractionError({
    message: classification.message,
    category: classification.category,
    phase: responseParsingPhase,
    code: classification.code,
    statusCode: classification.statusCode,
    diagnostics: [
      {
        code: classification.code,
        severity: "error",
        phase: responseParsingPhase,
        message: classification.message,
      },
    ],
    ...(serviceErrorCode === undefined ? {} : { serviceErrorCode }),
    ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
  });
}

/** Classification selected by an authentication-related HTTP status. */
interface AuthenticationClassification {
  readonly category: "authentication" | "permission";
  readonly code: string;
  readonly message: string;
  readonly statusCode: number;
}

/**
 * Returns the classification for 401 or 403.
 *
 * @param statusCode Transport status, when the transport reported one.
 * @returns The classification, or `undefined` for every other status.
 */
function classificationForStatus(
  statusCode: number | undefined,
): AuthenticationClassification | undefined {
  if (statusCode === unauthorizedStatus) {
    return {
      category: "authentication",
      code: authenticationFailedCode,
      message: "The service rejected the credential.",
      statusCode: unauthorizedStatus,
    };
  }
  if (statusCode === forbiddenStatus) {
    return {
      category: "permission",
      code: permissionDeniedCode,
      message: "The service refused permission for this call.",
      statusCode: forbiddenStatus,
    };
  }
  return undefined;
}

/**
 * Returns a service code as text, or `undefined` when the service omitted it.
 *
 * A numeric code is the canonical decimal of that integer. The service message
 * is never used as a substitute.
 *
 * @param code Service code stored on the error object.
 * @returns Text suitable for `serviceErrorCode`.
 */
function serviceCodeText(code: string | number | undefined): string | undefined {
  if (typeof code === "string") {
    return code;
  }
  if (typeof code === "number" && Number.isSafeInteger(code)) {
    return String(code);
  }
  return undefined;
}
