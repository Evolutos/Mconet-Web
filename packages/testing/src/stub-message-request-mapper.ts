// Copyright © 2026 Mcont.

import type { MessageRequestMapper } from "@evolutos/mconet-core-spi";

/**
 * Configurable MessageRequestMapper test double that records every input document.
 *
 * The stub records the original document identity before invoking one configured
 * synchronous handler, so both successful and failed mapping attempts remain
 * observable. It does not inspect, clone, validate, encode, or retain outputs.
 */
export class StubMessageRequestMapper implements MessageRequestMapper {
  /** Immutable component metadata exposed through the SPI boundary. */
  public readonly descriptor: MessageRequestMapper["descriptor"];

  /** Configured request-mapping behavior captured at construction. */
  readonly #mapRequest: MessageRequestMapper["mapRequest"];

  /** Ordered original input identities owned by this stub instance. */
  readonly #inputs: Array<Parameters<MessageRequestMapper["mapRequest"]>[0]> = [];

  /**
   * Captures one descriptor and one exact mapper handler.
   *
   * @param configuration Stable component metadata and mapping behavior.
   */
  public constructor(configuration: {
    readonly descriptor: MessageRequestMapper["descriptor"];
    readonly mapRequest: MessageRequestMapper["mapRequest"];
  }) {
    // Copy references once so later edits to a JavaScript configuration object do
    // not replace behavior or metadata on an already-created test double.
    this.descriptor = configuration.descriptor;
    this.#mapRequest = configuration.mapRequest;
  }

  /**
   * Records and delegates one message request mapping attempt.
   *
   * @param document Validated message document supplied by the caller.
   * @returns Exact erased runtime value returned by the configured handler.
   */
  public mapRequest(
    document: Parameters<MessageRequestMapper["mapRequest"]>[0],
  ): ReturnType<MessageRequestMapper["mapRequest"]> {
    // Record before delegation so an injected mapping failure still proves which
    // document reached the mapper boundary.
    this.#inputs.push(document);

    // Preserve both the input identity and the handler's return or thrown value;
    // protocol mapping remains entirely test-configured.
    return this.#mapRequest(document);
  }

  /**
   * Returns an immutable snapshot of all attempted mapping inputs.
   *
   * @returns Frozen input identities in exact invocation order.
   */
  public snapshotInputs(): ReadonlyArray<Parameters<MessageRequestMapper["mapRequest"]>[0]> {
    // Copy before freezing so later calls cannot alter an earlier assertion and
    // callers cannot mutate the stub's private history.
    return Object.freeze([...this.#inputs]);
  }
}
