// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type {
  ErasedRuntimeValue,
  TaskProtocolAdapter,
  TransportResponseMetadata,
} from "@evolutos/mconet-core-spi";

/** Stable code when service-error parsing throws an unclassified exception. */
const serviceErrorParsingFailedCode = "service_error_parsing_failed";

/**
 * Schedules service-error parsing.
 *
 * The adapter's `parseError` is called once. A returned interaction error is
 * kept by identity. A thrown interaction error is returned rather than wrapped
 * again. Any other throw becomes one parsing error whose message does not copy
 * the thrown text; the original value is retained as `cause`. This stage does
 * not call a transport.
 *
 * @param input Adapter, decoded error payload, and transport metadata.
 * @returns The classified service error.
 */
export function scheduleParseError(input: {
  readonly adapter: TaskProtocolAdapter;
  readonly payload: ErasedRuntimeValue;
  readonly metadata: TransportResponseMetadata;
}): ModelInteractionError {
  try {
    return input.adapter.parseError({
      payload: input.payload,
      metadata: input.metadata,
    });
  } catch (caught) {
    if (caught instanceof ModelInteractionError) {
      return caught;
    }
    return new ModelInteractionError({
      message: "The service error could not be parsed.",
      category: "model_service",
      phase: "response_parsing",
      code: serviceErrorParsingFailedCode,
      diagnostics: [
        {
          code: serviceErrorParsingFailedCode,
          severity: "error",
          phase: "response_parsing",
          message: "The service error could not be parsed.",
        },
      ],
      cause: caught,
    });
  }
}
