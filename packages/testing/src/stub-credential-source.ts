// Copyright © 2026 Mcont.

import type { CredentialSource } from "@evolutos/mconet-core-spi";

/**
 * Configurable CredentialSource test double for rotation and provider failures.
 *
 * Every resolution delegates to one asynchronous handler with the original
 * minimal lifecycle context. The stub does not cache credentials, unwrap SecretValue,
 * retry failures, observe cancellation itself, or record invocation details.
 */
export class StubCredentialSource implements CredentialSource {
  /** Configured credential resolution behavior captured at construction. */
  readonly #getCredential: CredentialSource["getCredential"];

  /**
   * Captures the exact asynchronous credential provider behavior.
   *
   * @param getCredential Handler that owns rotation, cancellation, and failures.
   */
  public constructor(getCredential: CredentialSource["getCredential"]) {
    // Store one stable handler reference so later variable reassignment cannot
    // change an already-created source instance.
    this.#getCredential = getCredential;
  }

  /**
   * Delegates one credential resolution attempt to the configured handler.
   *
   * @param context Minimal interaction lifecycle context.
   * @returns Handler-owned promise for an opaque protected credential.
   */
  public getCredential(
    context: Parameters<CredentialSource["getCredential"]>[0],
  ): ReturnType<CredentialSource["getCredential"]> {
    // Invoke the handler for every call and preserve context, promise, SecretValue,
    // or rejection identity without introducing SDK-side caching or retries.
    return this.#getCredential(context);
  }
}
