// Copyright © 2026 Mcont.

/**
 * Public module boundary for basic Mconet authentication components.
 *
 * Concrete schemes are exported as data descriptions. Handlers and credential
 * sources stay out of this entry until their own steps add them.
 */
export { apiKeyHeaderAuthorizationKind } from "./api-key-header-authorization.js";
export { bearerAuthorizationKind } from "./bearer-authorization.js";
export { FixedCredentialSource } from "./fixed-credential-source.js";
export { noAuthorizationKind } from "./no-authorization.js";
export type { ApiKeyHeaderAuthorization } from "./api-key-header-authorization.js";
export type { BearerAuthorization } from "./bearer-authorization.js";
export type { NoAuthorization } from "./no-authorization.js";
