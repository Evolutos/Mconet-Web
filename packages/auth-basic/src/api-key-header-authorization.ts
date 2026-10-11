// Copyright © 2026 Mcont.

import type { Authorization } from "@evolutos/mconet-core-domain";
import type { CredentialSource } from "@evolutos/mconet-core-spi";

/**
 * Fixed authorization kind for a credential sent in one named HTTP header.
 *
 * The literal selects this scheme. It is not the header name and it does not
 * identify the credential value.
 */
export const apiKeyHeaderAuthorizationKind = "authorization.api-key-header" as const;

/**
 * Authorization description for an API key carried by one request header.
 *
 * The header name and credential source stay separate so the description can
 * name the field without storing or resolving the secret. No header value,
 * prefix, query parameter, or signing input belongs to this scheme.
 */
export interface ApiKeyHeaderAuthorization extends Authorization {
  /** Fixed discriminator for the header API-key scheme. */
  readonly kind: typeof apiKeyHeaderAuthorizationKind;

  /** Header name that will receive the credential during authorization. */
  readonly headerName: string;

  /** Source consulted later to obtain the credential for that header. */
  readonly credentialSource: CredentialSource;
}
