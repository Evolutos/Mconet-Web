// Copyright © 2026 Mcont.

import { type ProcessingResult, type SecretValue } from "@evolutos/mconet-core-domain";
import type { CredentialSource, Transport } from "@evolutos/mconet-core-spi";

/** Stable code when a credential source rejects before any network call. */
const credentialReadFailedCode = "credential_read_failed";

/**
 * Schedules one credential read.
 *
 * The source is called once with the interaction signal. A rejection becomes
 * an authorization diagnostic and no secret. The thrown text is not copied.
 * The transport is part of the stage input so a failed read cannot proceed to
 * it; this function never calls `send`.
 *
 * @param input Credential source, cancellation signal, and the transport that must stay idle.
 * @returns The secret, or diagnostics and no value.
 */
export async function scheduleCredentialRead(input: {
  readonly credentialSource: CredentialSource;
  readonly signal: AbortSignal;
  readonly transport: Transport;
}): Promise<ProcessingResult<SecretValue>> {
  try {
    const value = await input.credentialSource.getCredential({ signal: input.signal });
    // A successful secret is returned to the authorization stage. Transport
    // still has to wait until that stage applies the secret.
    return { diagnostics: [], value };
  } catch {
    return {
      diagnostics: [
        {
          code: credentialReadFailedCode,
          severity: "error",
          phase: "authorization",
          message: "The credential could not be read.",
        },
      ],
    };
  }
}
