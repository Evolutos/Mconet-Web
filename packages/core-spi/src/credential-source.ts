// Copyright © 2026 Mcont.

import type { SecretValue } from "@evolutos/mconet-core-domain";

import type { CredentialContext } from "./credential-context.js";

/**
 * Asynchronously resolves one protected credential for an interaction.
 *
 * Implementations may return fixed, rotating, or remotely obtained credentials.
 * The SDK invokes the method during authorization for every interaction that
 * needs the source; implementations therefore must not assume that a value read
 * for one call remains valid for another. Refresh, persistence, provider retry,
 * and credential caching policies remain owned by the implementation.
 */
export interface CredentialSource {
  /**
   * Resolves the credential while observing the interaction cancellation signal.
   * Provider failures and cancellation are represented by promise rejection;
   * this contract does not wrap errors, retry, or substitute a cached value.
   *
   * @param context Minimal lifecycle context for this resolution attempt.
   * @returns A promise for an opaque value whose implicit representations are redacted.
   */
  getCredential(context: CredentialContext): Promise<SecretValue>;
}
