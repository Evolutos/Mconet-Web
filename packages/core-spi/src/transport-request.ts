// Copyright © 2026 Mcont.

import type { HeaderFields, QueryFields, UriValue } from "@evolutos/mconet-core-domain";

import type { TransportBody } from "./transport-body.js";

/**
 * Immutable protocol-neutral request snapshot ready for authorization or send.
 *
 * The method, final URI reference, ordered header and query occurrences, and
 * encoded body remain exact. This value does not join an endpoint and path,
 * validate a transport-specific method, merge repeated fields, percent-encode
 * query data, apply authorization, re-encode the body, or mark itself authorized.
 */
export interface TransportRequest {
  /** Protocol method text selected by the request mapper. */
  readonly method: string;

  /** Final absolute or relative destination URI reference. */
  readonly url: UriValue;

  /** Ordered request header occurrences, including repeated names. */
  readonly headers: HeaderFields;

  /** Ordered query occurrences retained before transport serialization. */
  readonly query: QueryFields;

  /** Complete encoded body accepted by the selected transport. */
  readonly body: TransportBody;
}
