// Copyright © 2026 Mcont.

import { ModelInteractionError, SecretValue } from "@evolutos/mconet-core-domain";
import type { CredentialContext, CredentialSource } from "@evolutos/mconet-core-spi";

/** Stable code for credential resolution stopped by the interaction signal. */
const CANCELLED_CREDENTIAL_CODE = "cancelled";

/** Reads one credential for a single resolution attempt. */
type CredentialReader = (context: CredentialContext) => Promise<SecretValue> | SecretValue;

/**
 * Credential source that reads a new credential on every resolution.
 *
 * The class stores the reader, not a credential. Each call invokes that reader
 * again and returns only the {@link SecretValue} produced for that call. A
 * previous result is not reused. An aborted interaction is rejected without
 * returning a credential, including when cancellation happens during the read.
 */
export class DynamicCredentialSource implements CredentialSource {
  /** Reader invoked once per resolution attempt. */
  readonly #read: CredentialReader;

  /**
   * Retains the credential reader.
   *
   * @param read Function that produces one protected credential per call.
   * @throws {TypeError} When the argument is not a function.
   */
  public constructor(read: CredentialReader) {
    // A reader is the only retained dependency. Storing a credential here would
    // turn a dynamic source into a fixed one.
    if (typeof read !== "function") {
      throw new TypeError("read must be a function.");
    }
    this.#read = read;
  }

  /**
   * Reads one credential for this attempt.
   *
   * @param context Cancellation signal supplied to the reader.
   * @returns The protected credential produced by this call's read.
   * @throws {ModelInteractionError} When the signal is aborted before or during the read.
   * @throws {TypeError} When the reader does not return a {@link SecretValue}.
   */
  public async getCredential(context: CredentialContext): Promise<SecretValue> {
    // Do not invoke the reader after the interaction has already stopped.
    if (context.signal.aborted) {
      throw createCancelledCredentialError();
    }

    const secret = await this.#read(context);

    // Cancellation during the read wins over a credential that is no longer
    // allowed to leave this source, and also wins over an invalid result.
    if (context.signal.aborted) {
      throw createCancelledCredentialError();
    }
    if (!(secret instanceof SecretValue)) {
      throw new TypeError("credential must be a SecretValue.");
    }
    return secret;
  }
}

/**
 * Creates the stable failure for a cancelled dynamic credential read.
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
