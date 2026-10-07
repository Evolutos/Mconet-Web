// Copyright © 2026 Mcont.

import type { PayloadEncoder } from "@evolutos/mconet-core-spi";

/**
 * Configurable PayloadEncoder test double for successful and failed encoding.
 *
 * The stub forwards the original erased value and codec context to one injected
 * asynchronous handler. It does not inspect payloads, observe signals, create
 * transport bodies, retry failures, wrap errors, or record invocations.
 */
export class StubPayloadEncoder implements PayloadEncoder {
  /** Immutable component metadata exposed through the SPI boundary. */
  public readonly descriptor: PayloadEncoder["descriptor"];

  /** Configured encoding behavior captured at construction. */
  readonly #encode: PayloadEncoder["encode"];

  /**
   * Captures component metadata and the exact asynchronous encoding behavior.
   *
   * @param configuration Stable descriptor and payload encoding handler.
   */
  public constructor(configuration: {
    readonly descriptor: PayloadEncoder["descriptor"];
    readonly encode: PayloadEncoder["encode"];
  }) {
    // Copy references once so later edits to a JavaScript configuration object
    // cannot replace metadata or behavior on an already-created test double.
    this.descriptor = configuration.descriptor;
    this.#encode = configuration.encode;
  }

  /**
   * Delegates one payload encoding attempt to the configured handler.
   *
   * @param value Validated erased protocol value supplied by the runtime.
   * @param context Codec lifecycle context carrying the composed abort signal.
   * @returns Handler-owned promise for a transport body.
   */
  public encode(
    value: Parameters<PayloadEncoder["encode"]>[0],
    context: Parameters<PayloadEncoder["encode"]>[1],
  ): ReturnType<PayloadEncoder["encode"]> {
    // Forward both identities unchanged and return the original promise so tests
    // can inject exact bodies, delays, cancellation behavior, or rejections.
    return this.#encode(value, context);
  }
}
