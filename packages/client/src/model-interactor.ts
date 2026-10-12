// Copyright © 2026 Mcont.

import type { ModelOutput, ModelRequest } from "@evolutos/mconet-core-domain";
import type { InteractionOptions } from "@evolutos/mconet-core-spi";

/**
 * Public call surface for one model interaction.
 *
 * The only operation is a single request that returns one assembled output.
 * Streaming, duplex sessions, and long-running submission stay off this type
 * until their own lifecycles exist. The interface does not construct a client,
 * choose components, or execute a request.
 */
export interface ModelInteractor {
  /**
   * Runs one model request.
   *
   * Options apply only to this call. Omitting them leaves cancellation,
   * deadline, components, and raw-response capture to the implementation.
   *
   * @param request Task-neutral request envelope.
   * @param options Optional per-call overrides. Absence is not a stored default.
   * @returns The assembled output for this request.
   */
  interact(request: ModelRequest, options?: InteractionOptions): Promise<ModelOutput>;
}
