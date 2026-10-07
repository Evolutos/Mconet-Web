// Copyright © 2026 Mcont.

/**
 * Immutable lifecycle context available during one payload codec operation.
 *
 * The interaction's composed signal carries both caller cancellation and the
 * runtime deadline, allowing asynchronous codecs to stop work without gaining
 * access to requests, responses, media types, credentials, transport settings,
 * or unrelated resource limits. Type and schema facts remain on the erased
 * value and component contracts rather than being duplicated in this context.
 */
export interface CodecContext {
  /** Signal that aborts codec work with the owning interaction. */
  readonly signal: AbortSignal;
}
