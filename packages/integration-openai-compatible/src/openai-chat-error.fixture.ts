// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type { ErasedRuntimeValue, TransportResponseMetadata } from "@evolutos/mconet-core-spi";

/** Service text that must never appear on the mapped error. */
export const openAIChatFixtureErrorText = "secret-fixture-error-text";

/** Decoded error envelope for the stable 401 fixture. */
export const openAIChatFixtureErrorBody = Object.freeze({
  error: Object.freeze({
    message: openAIChatFixtureErrorText,
    type: "invalid_request_error",
    code: "invalid_api_key",
  }),
});

/** Payload envelope around the error fixture body. */
export const openAIChatFixtureErrorPayload: ErasedRuntimeValue = {
  typeId: "json.value",
  value: openAIChatFixtureErrorBody,
};

/** Transport metadata that selects the authentication branch. */
export const openAIChatFixtureErrorMetadata: TransportResponseMetadata = {
  outcome: "service_error",
  statusCode: 401,
  headers: [],
  requestId: "req-fixture",
  extensions: {},
};

/**
 * Returns the interaction error the 401 fixture must produce.
 *
 * A new instance is returned each call. The service message is not included.
 *
 * @returns The expected authentication error.
 */
export function createOpenAIChatFixtureError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "The service rejected the credential.",
    category: "authentication",
    phase: "response_parsing",
    code: "service_authentication_failed",
    statusCode: 401,
    serviceErrorCode: "invalid_api_key",
    requestId: "req-fixture",
    diagnostics: [
      {
        code: "service_authentication_failed",
        severity: "error",
        phase: "response_parsing",
        message: "The service rejected the credential.",
      },
    ],
  });
}
