// Copyright © 2026 Mcont.

import type { Authorization } from "@evolutos/mconet-core-domain";

/**
 * Fixed authorization kind for an interaction that sends no credentials.
 *
 * The literal is the only selector for this scheme. It is not a header name,
 * a credential, or a signal to inherit authorization from another layer.
 */
export const noAuthorizationKind = "authorization.none" as const;

/**
 * Authorization description that explicitly selects no credentials.
 *
 * The kind is fixed so a handler can recognize this scheme without inspecting
 * any other field. The description carries no header name, credential source,
 * token, or signing material.
 */
export interface NoAuthorization extends Authorization {
  /** Fixed discriminator for the no-credential authorization scheme. */
  readonly kind: typeof noAuthorizationKind;
}
