// Copyright © 2026 Mcont.

import type { ParsedTaskResponse, ProcessingResult } from "@evolutos/mconet-core-domain";
import type {
  ErasedRuntimeValue,
  TaskProtocolAdapter,
  TransportResponseMetadata,
} from "@evolutos/mconet-core-spi";

/** Stable code when success parsing fails. */
const responseParsingFailedCode = "response_parsing_failed";

/**
 * Schedules success-response parsing.
 *
 * The adapter's `parseResponse` is called once. Its processing result is
 * returned unchanged, including a failure without a value. A thrown exception
 * becomes one parsing diagnostic and no value. The thrown text is not copied.
 * This stage does not assemble a model output.
 *
 * @param input Adapter, decoded payload, and transport metadata.
 * @returns The adapter's parsed response, or diagnostics and no value.
 */
export function scheduleParseResponse(input: {
  readonly adapter: TaskProtocolAdapter;
  readonly payload: ErasedRuntimeValue;
  readonly metadata: TransportResponseMetadata;
}): ProcessingResult<ParsedTaskResponse> {
  try {
    return input.adapter.parseResponse({
      payload: input.payload,
      metadata: input.metadata,
    });
  } catch {
    return {
      diagnostics: [
        {
          code: responseParsingFailedCode,
          severity: "error",
          phase: "response_parsing",
          message: "The successful response could not be parsed.",
        },
      ],
    };
  }
}
