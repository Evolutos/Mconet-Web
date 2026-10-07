// Copyright © 2026 Mcont.

import type { RuntimeComponent } from "./runtime-component.js";
import type { TransportContext } from "./transport-context.js";
import type { TransportRequest } from "./transport-request.js";
import type { TransportResponse } from "./transport-response.js";

/**
 * Replaceable asynchronous boundary for one unary encoded request exchange.
 *
 * Implementations receive only a transport-ready request and per-interaction
 * execution controls. They must return protocol-neutral metadata plus response
 * bytes without interpreting model-domain data, selecting codecs, resolving
 * authorization, reading credentials, or parsing provider response payloads.
 */
export interface Transport extends RuntimeComponent {
  /** Sends one encoded request and resolves with its buffered byte response. */
  send(request: TransportRequest, context: TransportContext): Promise<TransportResponse>;
}
