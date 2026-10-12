// Copyright © 2026 Mcont.

import type {
  ProcessingResult,
  ResolvedInteractionResourceLimits,
} from "@evolutos/mconet-core-domain";
import type { Transport, TransportRequest, TransportResponse } from "@evolutos/mconet-core-spi";

/** Stable code when the transport rejects before a response can be decoded. */
const transportFailedCode = "transport_failed";

/**
 * Schedules one transport send.
 *
 * The transport is called once with the authorized request. The context carries
 * the composed signal, the optional deadline, and the resolved response-byte
 * limit. A rejection becomes a transport diagnostic and no response. The thrown
 * text is not copied. This stage does not decode or parse.
 *
 * @param input Transport, authorized request, and the controls that must propagate.
 * @returns The transport response, or diagnostics and no value.
 */
export async function scheduleTransportSend(input: {
  readonly transport: Transport;
  readonly request: TransportRequest;
  readonly signal: AbortSignal;
  readonly deadline?: number;
  readonly resourceLimits: ResolvedInteractionResourceLimits;
}): Promise<ProcessingResult<TransportResponse>> {
  try {
    const response = await input.transport.send(input.request, {
      signal: input.signal,
      maxResponseBodyBytes: input.resourceLimits.maxResponseBodyBytes,
      ...(input.deadline === undefined ? {} : { deadline: input.deadline }),
    });
    return { diagnostics: [], value: response };
  } catch {
    return {
      diagnostics: [
        {
          code: transportFailedCode,
          severity: "error",
          phase: "transport",
          message: "The transport could not complete the request.",
        },
      ],
    };
  }
}
