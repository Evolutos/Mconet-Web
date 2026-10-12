// Copyright © 2026 Mcont.

import type { ModelInteractor } from "./model-interactor.js";

/**
 * Public client surface: one interaction call plus an idempotent close.
 *
 * The current type libraries do not include `AsyncDisposable`, so this contract
 * exposes `close` directly instead of raising the runtime requirement. A later
 * compatible entry may bind `Symbol.asyncDispose` to the same close behavior.
 * This interface does not open a client, reject requests, or release resources.
 */
export interface ModelClient extends ModelInteractor {
  /**
   * Releases SDK-owned client resources.
   *
   * A second call must be safe. Injected resources stay with their owner.
   * Those rules belong to the implementation, not to this type.
   *
   * @returns A promise that settles when SDK-owned release has finished.
   */
  close(): Promise<void>;
}
