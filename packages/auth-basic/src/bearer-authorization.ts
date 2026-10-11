// Copyright © 2026 Mcont.

import type { Authorization } from "@evolutos/mconet-core-domain";
import type { CredentialSource } from "@evolutos/mconet-core-spi";

/**
 * Fixed authorization kind for an HTTP Bearer credential.
 *
 * The literal selects this scheme. It is not the credential and it does not
 * name a caller-chosen header.
 */
export const bearerAuthorizationKind = "authorization.bearer" as const;

/**
 * Authorization description for a Bearer credential.
 *
 * The credential source is a required dependency of the description. The
 * scheme does not store the token, choose a header name, or carry a prefix;
 * those decisions belong to the handler that later applies the source.
 */
export interface BearerAuthorization extends Authorization {
  /** Fixed discriminator for the Bearer scheme. */
  readonly kind: typeof bearerAuthorizationKind;

  /** Source consulted later to obtain the Bearer credential. */
  readonly credentialSource: CredentialSource;
}
