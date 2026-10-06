// Copyright © 2026 Mcont.

/**
 * Immutable per-interaction context available while resolving a credential.
 *
 * Credential selection inputs belong to the configured credential source, so
 * this context exposes only interaction cancellation. Keeping request targets,
 * endpoints, headers, bodies, authorization data, and secrets outside this
 * boundary prevents credential providers from acquiring unrelated request
 * authority. Runtime code must pass the interaction's composed signal so a
 * provider can stop asynchronous work after caller cancellation or deadline.
 */
export interface CredentialContext {
  /** Signal that aborts credential resolution with the owning interaction. */
  readonly signal: AbortSignal;
}
