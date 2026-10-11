// Copyright © 2026 Mcont.

/**
 * Public module boundary for basic Mconet authentication components.
 *
 * Concrete schemes are exported as data descriptions. Handlers and credential
 * sources stay out of this entry until their own steps add them.
 */
export { apiKeyHeaderAuthorizationKind } from "./api-key-header-authorization.js";
export { noAuthorizationKind } from "./no-authorization.js";
export type { ApiKeyHeaderAuthorization } from "./api-key-header-authorization.js";
export type { NoAuthorization } from "./no-authorization.js";
