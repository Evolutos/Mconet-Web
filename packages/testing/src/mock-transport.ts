// Copyright © 2026 Mcont.

import type { Transport } from "@evolutos/mconet-core-spi";

/**
 * Transport test double that resolves every send with one configured response.
 *
 * The mock supplies deterministic protocol-neutral metadata and buffered bytes
 * without inspecting requests or execution controls. It does not record calls,
 * perform I/O, enforce limits, observe cancellation, or decode response bodies.
 */
export class MockTransport implements Transport {
  /** Immutable component metadata exposed through the SPI boundary. */
  public readonly descriptor: Transport["descriptor"];

  /** Exact transport response resolved for every send operation. */
  readonly #response: Awaited<ReturnType<Transport["send"]>>;

  /**
   * Captures component metadata and one deterministic transport response.
   *
   * @param configuration Stable descriptor and complete buffered response.
   */
  public constructor(configuration: {
    readonly descriptor: Transport["descriptor"];
    readonly response: Awaited<ReturnType<Transport["send"]>>;
  }) {
    // Copy both references once so later edits to a JavaScript configuration
    // object cannot replace metadata or the response on an existing mock.
    this.descriptor = configuration.descriptor;
    this.#response = configuration.response;
  }

  /**
   * Resolves one send operation with the configured response.
   *
   * @param request Transport-ready request intentionally left uninterpreted.
   * @param context Execution controls intentionally left unobserved.
   * @returns Promise resolved with the exact configured response object.
   */
  public send(
    request: Parameters<Transport["send"]>[0],
    context: Parameters<Transport["send"]>[1],
  ): ReturnType<Transport["send"]> {
    // Acknowledge both SPI inputs without reading, cloning, or retaining them;
    // request observation belongs to the separate recording test double.
    void request;
    void context;

    // Resolve asynchronously as required by the SPI while preserving the exact
    // response, metadata, and buffered-byte identities configured by the test.
    return Promise.resolve(this.#response);
  }
}
