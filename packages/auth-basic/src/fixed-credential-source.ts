// Copyright © 2026 Mcont.

import { ModelInteractionError, SecretValue } from "@evolutos/mconet-core-domain";
import type { CredentialContext, CredentialSource } from "@evolutos/mconet-core-spi";

/** Stable code for credential resolution stopped by the interaction signal. */
const CANCELLED_CREDENTIAL_CODE = "cancelled";

/**
 * Credential source that returns one credential captured at construction.
 *
 * The credential is retained only as a {@link SecretValue}. The class has no
 * public field, string conversion, or JSON form that reveals plaintext. Each
 * resolution returns that same wrapper and does not read, copy, or refresh it.
 * An already aborted interaction is rejected before the wrapper is returned.
 */
export class FixedCredentialSource implements CredentialSource {
  /** Protected credential retained for every successful resolution. */
  readonly #secret: SecretValue;

  /**
   * Retains one protected credential.
   *
   * @param secret Credential wrapper to return from later resolutions.
   * @throws {TypeError} When the argument is not a {@link SecretValue}.
   */
  public constructor(secret: SecretValue) {
    // Reject a raw string or other wrapper so plaintext cannot be stored in a
    // public or string-convertible field of this source.
    if (!(secret instanceof SecretValue)) {
      throw new TypeError("secret must be a SecretValue.");
    }
    this.#secret = secret;
  }

  /**
   * Returns the retained credential unless the interaction is already cancelled.
   *
   * @param context Cancellation signal for this resolution attempt.
   * @returns The same protected credential stored at construction.
   * @throws {ModelInteractionError} When the interaction signal is already aborted.
   */
  public async getCredential(context: CredentialContext): Promise<SecretValue> {
    // A fixed source has no asynchronous work. Observe cancellation before
    // handing the credential to authorization so a stopped interaction does
    // not receive it.
    if (context.signal.aborted) {
      throw createCancelledCredentialError();
    }
    return this.#secret;
  }
}

/**
 * Creates the stable failure for a cancelled fixed-credential read.
 *
 * @returns An error that identifies cancellation and contains no credential text.
 */
function createCancelledCredentialError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Credential resolution was cancelled.",
    category: "cancelled",
    phase: "authorization",
    code: CANCELLED_CREDENTIAL_CODE,
    diagnostics: [],
  });
}
