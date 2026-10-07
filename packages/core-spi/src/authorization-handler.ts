// Copyright © 2026 Mcont.

import type { Authorization } from "@evolutos/mconet-core-domain";

import type { AuthorizationContext } from "./authorization-context.js";
import type { RuntimeComponent } from "./runtime-component.js";
import type { TransportRequest } from "./transport-request.js";

/**
 * Replaceable behavior that applies one supported authorization description.
 *
 * Support inspection receives only the open authorization value. Application
 * receives the encoded request and narrowly scoped non-sensitive context, then
 * returns a new immutable request. Implementations may resolve credentials
 * through their own configured source but must not mutate the input request,
 * perform transport I/O, encode payloads, or parse responses.
 */
export interface AuthorizationHandler extends RuntimeComponent {
  /** Reports whether this handler can interpret the authorization description. */
  supports(authorization: Authorization): boolean;

  /** Applies authorization and resolves with the resulting request snapshot. */
  apply(input: {
    readonly request: TransportRequest;
    readonly authorization: Authorization;
    readonly context: AuthorizationContext;
  }): Promise<TransportRequest>;
}
