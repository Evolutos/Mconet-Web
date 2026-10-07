// Copyright © 2026 Mcont.

import type { PayloadDecoder } from "@evolutos/mconet-core-spi";

/**
 * Configurable PayloadDecoder test double for successful and failed decoding.
 *
 * The stub forwards the original bounded bytes and codec context to one injected
 * asynchronous handler. It does not inspect or copy bytes, observe signals,
 * create erased values, retry failures, wrap errors, or record invocations.
 */
export class StubPayloadDecoder implements PayloadDecoder {
  /** Immutable component metadata exposed through the SPI boundary. */
  public readonly descriptor: PayloadDecoder["descriptor"];

  /** Configured decoding behavior captured at construction. */
  readonly #decode: PayloadDecoder["decode"];

  /**
   * Captures component metadata and the exact asynchronous decoding behavior.
   *
   * @param configuration Stable descriptor and payload decoding handler.
   */
  public constructor(configuration: {
    readonly descriptor: PayloadDecoder["descriptor"];
    readonly decode: PayloadDecoder["decode"];
  }) {
    // Copy references once so later edits to a JavaScript configuration object
    // cannot replace metadata or behavior on an already-created test double.
    this.descriptor = configuration.descriptor;
    this.#decode = configuration.decode;
  }

  /**
   * Delegates one payload decoding attempt to the configured handler.
   *
   * @param bytes Bounded response bytes supplied by the runtime.
   * @param context Codec lifecycle context carrying the composed abort signal.
   * @returns Handler-owned promise for an erased protocol value.
   */
  public decode(
    bytes: Parameters<PayloadDecoder["decode"]>[0],
    context: Parameters<PayloadDecoder["decode"]>[1],
  ): ReturnType<PayloadDecoder["decode"]> {
    // Forward both identities unchanged and return the original promise so tests
    // can inject exact values, delays, cancellation behavior, or rejections.
    return this.#decode(bytes, context);
  }
}
