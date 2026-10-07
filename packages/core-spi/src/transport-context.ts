// Copyright © 2026 Mcont.

/**
 * Immutable per-interaction controls required by a transport send operation.
 *
 * The already composed signal is the authoritative cancellation channel. The
 * optional absolute deadline remains an observation for transports that can
 * apply native timeout controls, while the required response-byte limit bounds
 * incremental body collection. This context carries no request, credentials,
 * authorization, response data, component selection, or mutable client state.
 */
export interface TransportContext {
  /** Composed cancellation signal that every transport operation must observe. */
  readonly signal: AbortSignal;

  /** Absolute deadline in Unix epoch milliseconds when one is configured. */
  readonly deadline?: number;

  /** Maximum response body bytes that may be retained for this interaction. */
  readonly maxResponseBodyBytes: number;
}
