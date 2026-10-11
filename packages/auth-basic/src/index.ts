// Copyright © 2026 Mcont.

/**
 * Public module boundary for basic Mconet authentication components.
 *
 * Concrete schemes are exported as data descriptions. Handlers and credential
 * sources stay out of this entry until their own steps add them.
 */
export {
  ApiKeyHeaderAuthorizationHandler,
  apiKeyHeaderAuthorizationHandlerDescriptor,
} from "./api-key-header-authorization-handler.js";
export { apiKeyHeaderAuthorizationKind } from "./api-key-header-authorization.js";
export { bearerAuthorizationKind } from "./bearer-authorization.js";
export {
  BearerAuthorizationHandler,
  bearerAuthorizationHandlerDescriptor,
} from "./bearer-authorization-handler.js";
export { DynamicCredentialSource } from "./dynamic-credential-source.js";
export { FixedCredentialSource } from "./fixed-credential-source.js";
export {
  NoAuthorizationHandler,
  noAuthorizationHandlerDescriptor,
} from "./no-authorization-handler.js";
export { noAuthorizationKind } from "./no-authorization.js";
export { validateAuthorizationHeaderName } from "./validate-authorization-header-name.js";
export { validateAuthorizationHeaderValue } from "./validate-authorization-header-value.js";
export type { ApiKeyHeaderAuthorization } from "./api-key-header-authorization.js";
export type { BearerAuthorization } from "./bearer-authorization.js";
export type { NoAuthorization } from "./no-authorization.js";
