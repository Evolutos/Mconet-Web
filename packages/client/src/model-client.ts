// Copyright © 2026 Mcont.

import type { ModelRequest } from "@evolutos/mconet-core-domain";
import type { InteractionOptions } from "@evolutos/mconet-core-spi";

import type { ModelInteractor } from "./model-interactor.js";
import type { TextStreamInteraction } from "./text-stream-interaction.js";

/**
 * Public client surface: unary `interact`, server-stream `stream`, and close.
 *
 * The current type libraries do not include `AsyncDisposable`, so this contract
 * exposes `close` directly instead of raising the runtime requirement. A later
 * compatible entry may bind `Symbol.asyncDispose` to the same close behavior.
 * This interface does not open a client, reject requests, or release resources.
 */
export interface ModelClient extends ModelInteractor {
  /**
   * Runs one text request as a server stream.
   *
   * Unary `interact` stays the default. This call sets the mode to
   * `server_stream` and returns text as it arrives, plus the final output.
   *
   * @param request Task-neutral request envelope.
   * @param options Optional per-call overrides.
   * @returns Fragment events and the assembled output.
   */
  stream(request: ModelRequest, options?: InteractionOptions): TextStreamInteraction;

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
