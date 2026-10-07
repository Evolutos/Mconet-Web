// Copyright © 2026 Mcont.

import type { Authorization } from "@evolutos/mconet-core-domain";

import type { AuthorizationHandler } from "./authorization-handler.js";
import type { RuntimeComponent } from "./runtime-component.js";

/**
 * Replaceable behavior that selects exactly one compatible authorization handler.
 *
 * Resolution is synchronous because handler support inspection is synchronous and
 * must not read credentials, modify requests, or perform transport I/O. A resolver
 * returns the sole compatible candidate and reports both zero and multiple matches
 * as configuration failures; it must never depend on candidate ordering to hide an
 * ambiguous configuration.
 */
export interface AuthorizationHandlerResolver extends RuntimeComponent {
  /** Selects the unique handler for one authorization description. */
  resolve(input: {
    readonly authorization: Authorization;
    readonly handlers: readonly AuthorizationHandler[];
  }): AuthorizationHandler;
}
