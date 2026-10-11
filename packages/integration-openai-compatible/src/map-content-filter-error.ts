// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

import { OpenAIChatCompletionErrorDTO } from "./openai-chat-completion-error-dto.js";

/** Service codes that identify a content-policy rejection. */
const policyCodes: ReadonlySet<string> = new Set(["content_filter", "content_policy_violation"]);

/** Stable code for a content-policy rejection. */
const contentFilteredCode = "service_content_filtered";

/** Phase of a failure read from a service response. */
const responseParsingPhase = "response_parsing";

/** Fixed technical summary. The service message is never copied into it. */
const contentFilteredMessage = "The service content policy rejected the call.";

/**
 * Maps a content-policy chat-completions error onto a content-filter interaction error.
 *
 * The branch matches the service `code` or `type` against a fixed policy set.
 * It does not search the service message, and it does not treat a success
 * `finish_reason` as this error. A body that is not a policy rejection returns
 * `undefined`. Status-specific branches remain responsible for 401, 403, and 429
 * when dispatch consults them first.
 *
 * @param input Decoded error, optional status, and optional request id.
 * @returns The classified error, or `undefined` when the body is not a policy rejection.
 */
export function mapContentFilterError(input: {
  readonly statusCode?: number;
  readonly error: OpenAIChatCompletionErrorDTO;
  readonly requestId?: string;
}): ModelInteractionError | undefined {
  if (!(input.error instanceof OpenAIChatCompletionErrorDTO)) {
    throw new TypeError("Content-filter mapping requires an OpenAIChatCompletionErrorDTO.");
  }
  if (!isPolicyRejection(input.error)) {
    return undefined;
  }

  const serviceErrorCode = serviceCodeText(input.error.code);
  return new ModelInteractionError({
    message: contentFilteredMessage,
    category: "content_filter",
    phase: responseParsingPhase,
    code: contentFilteredCode,
    diagnostics: [
      {
        code: contentFilteredCode,
        severity: "error",
        phase: responseParsingPhase,
        message: contentFilteredMessage,
      },
    ],
    ...(input.statusCode === undefined ? {} : { statusCode: input.statusCode }),
    ...(serviceErrorCode === undefined ? {} : { serviceErrorCode }),
    ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
  });
}

/**
 * Returns whether the error object names a content policy.
 *
 * @param error Decoded service error.
 * @returns Whether `code` or `type` is a known policy identifier.
 */
function isPolicyRejection(error: OpenAIChatCompletionErrorDTO): boolean {
  // Compare identifiers only. Message text can quote a policy term without being one.
  return (
    (typeof error.code === "string" && policyCodes.has(error.code)) ||
    (error.errorType !== undefined && policyCodes.has(error.errorType))
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
