// Copyright © 2026 Mcont.

import type { MessageResponseMapper } from "@evolutos/mconet-core-spi";

/**
 * MessageResponseMapper test double that always returns one configured result.
 *
 * The stub provides a deterministic atomic document-and-Artifact-Catalog result
 * for every decoded fragment. It does not inspect inputs, parse protocol data,
 * clone the configured result, record calls, or inject failures.
 */
export class StubMessageResponseMapper implements MessageResponseMapper {
  /** Immutable component metadata exposed through the SPI boundary. */
  public readonly descriptor: MessageResponseMapper["descriptor"];

  /** Exact message mapping result returned for every invocation. */
  readonly #result: ReturnType<MessageResponseMapper["mapResponse"]>;

  /**
   * Captures the component metadata and deterministic mapping result.
   *
   * @param configuration Stable descriptor and complete atomic mapping result.
   */
  public constructor(configuration: {
    readonly descriptor: MessageResponseMapper["descriptor"];
    readonly result: ReturnType<MessageResponseMapper["mapResponse"]>;
  }) {
    // Copy both references once so later edits to a JavaScript configuration
    // object cannot replace this instance's metadata or fixed result.
    this.descriptor = configuration.descriptor;
    this.#result = configuration.result;
  }

  /**
   * Returns the configured result for one decoded response fragment.
   *
   * @param fragment Decoded protocol fragment intentionally left uninterpreted.
   * @returns Exact configured document-and-Artifact-Catalog result.
   */
  public mapResponse(
    fragment: Parameters<MessageResponseMapper["mapResponse"]>[0],
  ): ReturnType<MessageResponseMapper["mapResponse"]> {
    // Acknowledge the SPI input without reading or narrowing its opaque payload;
    // fixed-result behavior is independent of protocol content by design.
    void fragment;

    // Returning the same identity makes response mapping deterministic while the
    // caller remains responsible for supplying a valid decoded fragment.
    return this.#result;
  }
}
