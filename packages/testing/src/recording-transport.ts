// Copyright © 2026 Mcont.

import type { Transport } from "@evolutos/mconet-core-spi";

/**
 * Configurable Transport test double that records every send input pair.
 *
 * Each call is recorded before delegation, preserving the original request and
 * context identities even when the configured handler fails. The recorder does
 * not clone bytes, perform I/O, interpret fields, or reset captured history.
 */
export class RecordingTransport implements Transport {
  /** Immutable component metadata exposed through the SPI boundary. */
  public readonly descriptor: Transport["descriptor"];

  /** Configured asynchronous send behavior captured at construction. */
  readonly #send: Transport["send"];

  /** Ordered input pairs owned exclusively by this transport instance. */
  readonly #calls: Array<
    Readonly<{
      request: Parameters<Transport["send"]>[0];
      context: Parameters<Transport["send"]>[1];
    }>
  > = [];

  /**
   * Captures component metadata and the exact asynchronous send behavior.
   *
   * @param configuration Stable descriptor and transport handler.
   */
  public constructor(configuration: {
    readonly descriptor: Transport["descriptor"];
    readonly send: Transport["send"];
  }) {
    // Copy references once so later edits to a JavaScript configuration object
    // cannot replace metadata or behavior on an already-created test double.
    this.descriptor = configuration.descriptor;
    this.#send = configuration.send;
  }

  /**
   * Records and delegates one transport send attempt.
   *
   * @param request Transport-ready request retained by identity.
   * @param context Execution controls retained by identity.
   * @returns Handler-owned promise for the transport response.
   */
  public send(
    request: Parameters<Transport["send"]>[0],
    context: Parameters<Transport["send"]>[1],
  ): ReturnType<Transport["send"]> {
    // Freeze each pair before delegation so URL, headers, body, and signal remain
    // associated with the same attempt even when the handler rejects or throws.
    this.#calls.push(Object.freeze({ request, context }));

    // Preserve request, context, promise, response, and failure identities; the
    // configured handler remains solely responsible for transport behavior.
    return this.#send(request, context);
  }

  /**
   * Returns an immutable snapshot of recorded transport input pairs.
   *
   * @returns Frozen call entries in exact send-attempt order.
   */
  public snapshotCalls(): ReadonlyArray<
    Readonly<{
      request: Parameters<Transport["send"]>[0];
      context: Parameters<Transport["send"]>[1];
    }>
  > {
    // Copy before freezing so later sends cannot change an earlier assertion and
    // callers cannot mutate the transport's private ordered history.
    return Object.freeze([...this.#calls]);
  }
}
