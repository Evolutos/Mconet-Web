// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

import { matchesContentPolicyError } from "./map-content-filter-error.js";
import { OpenAIChatCompletionErrorDTO } from "./openai-chat-completion-error-dto.js";

/** Lowest HTTP status treated as a server failure. */
const serverErrorStatusMinimum = 500;

/** Highest HTTP status treated as a server failure. */
const serverErrorStatusMaximum = 599;

/** Statuses owned by the authentication and rate-limit branches. */
const claimedStatuses: ReadonlySet<number> = new Set([401, 403, 429]);

/** Stable code for a 5xx service failure. */
const serviceErrorCode = "service_error";

/** Stable code for a service failure that has no more specific branch. */
const unrecognizedServiceErrorCode = "unrecognized_service_error";

/** Phase of a failure read from a service response. */
const responseParsingPhase = "response_parsing";

/** Fixed summary for a 5xx body. The service message is never copied into it. */
const serverErrorMessage = "The service failed while handling the call.";

/** Fixed summary for a body no specific branch claims. */
const unrecognizedMessage = "The service returned an error with no specific classification.";

/**
 * Maps a chat-completions error that no specific branch claims.
 *
 * HTTP 5xx becomes a model-service error. Any other remaining status, including
 * a missing status, becomes an unknown service error. 401, 403, 429, and a
 * content-policy body return `undefined` so those branches keep the failure.
 * The service message is not copied, and a 5xx status is not marked transient.
 *
 * @param input Status, decoded error, and optional request id.
 * @returns The classified error, or `undefined` when a specific branch owns it.
 */
export function mapGenericServiceError(input: {
  readonly statusCode?: number;
  readonly error: OpenAIChatCompletionErrorDTO;
  readonly requestId?: string;
}): ModelInteractionError | undefined {
  if (!(input.error instanceof OpenAIChatCompletionErrorDTO)) {
    throw new TypeError("Generic service mapping requires an OpenAIChatCompletionErrorDTO.");
  }
  if (
    (input.statusCode !== undefined && claimedStatuses.has(input.statusCode)) ||
    matchesContentPolicyError(input.error)
  ) {
    return undefined;
  }

  const serverError = isServerStatus(input.statusCode);
  const code = serverError ? serviceErrorCode : unrecognizedServiceErrorCode;
  const message = serverError ? serverErrorMessage : unrecognizedMessage;
  const reportedCode = serviceCodeText(input.error.code);
  return new ModelInteractionError({
    message,
    category: serverError ? "model_service" : "unknown",
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
    ...(input.statusCode === undefined ? {} : { statusCode: input.statusCode }),
    ...(reportedCode === undefined ? {} : { serviceErrorCode: reportedCode }),
    ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
  });
}

/**
 * Returns whether a status is an integer HTTP 5xx code.
 *
 * @param statusCode Transport status, when reported.
 * @returns Whether the status is from 500 through 599.
 */
function isServerStatus(statusCode: number | undefined): boolean {
  return (
    typeof statusCode === "number" &&
    Number.isInteger(statusCode) &&
    statusCode >= serverErrorStatusMinimum &&
    statusCode <= serverErrorStatusMaximum
  );
}

/**
 * Returns a service code as text, or `undefined` when the service omitted it.
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
