// Copyright © 2026 Mcont.

import type { AuthorizationHandler } from "@evolutos/mconet-core-spi";

/**
 * Configurable AuthorizationHandler test double that records apply inputs.
 *
 * Support inspection and asynchronous application delegate to independent
 * handlers. Each application input is recorded before delegation; the stub does
 * not resolve credentials, mutate requests, inspect secrets, or perform I/O.
 */
export class StubAuthorizationHandler implements AuthorizationHandler {
  /** Immutable component metadata exposed through the SPI boundary. */
  public readonly descriptor: AuthorizationHandler["descriptor"];

  /** Configured authorization-kind support behavior. */
  readonly #supports: AuthorizationHandler["supports"];

  /** Configured asynchronous authorization application behavior. */
  readonly #apply: AuthorizationHandler["apply"];

  /** Ordered original application input identities owned by this instance. */
  readonly #applications: Array<Parameters<AuthorizationHandler["apply"]>[0]> = [];

  /**
   * Captures component metadata and both exact handler behaviors.
   *
   * @param configuration Stable descriptor, support matcher, and apply handler.
   */
  public constructor(configuration: {
    readonly descriptor: AuthorizationHandler["descriptor"];
    readonly supports: AuthorizationHandler["supports"];
    readonly apply: AuthorizationHandler["apply"];
  }) {
    // Copy references once so later edits to a JavaScript configuration object
    // cannot replace metadata or behavior on an already-created test double.
    this.descriptor = configuration.descriptor;
    this.#supports = configuration.supports;
    this.#apply = configuration.apply;
  }

  /** Delegates authorization-kind support inspection without recording application work. */
  public supports(
    authorization: Parameters<AuthorizationHandler["supports"]>[0],
  ): ReturnType<AuthorizationHandler["supports"]> {
    // Preserve the exact open authorization value and matcher result; support
    // inspection remains separate from request authorization attempts.
    return this.#supports(authorization);
  }

  /**
   * Records and delegates one authorization application attempt.
   *
   * @param input Immutable request, authorization description, and safe context.
   * @returns Handler-owned promise for the resulting request snapshot.
   */
  public apply(
    input: Parameters<AuthorizationHandler["apply"]>[0],
  ): ReturnType<AuthorizationHandler["apply"]> {
    // Record before delegation so rejected or synchronously failed application
    // remains observable without exposing any credential obtained by a handler.
    this.#applications.push(input);

    // Preserve input, promise, resulting request, and failure identities; the
    // configured handler remains solely responsible for authorization behavior.
    return this.#apply(input);
  }

  /**
   * Returns an immutable snapshot of authorization application inputs.
   *
   * @returns Frozen inputs in exact application-attempt order.
   */
  public snapshotApplications(): ReadonlyArray<Parameters<AuthorizationHandler["apply"]>[0]> {
    // Copy before freezing so later applications cannot alter an earlier
    // assertion and callers cannot mutate the private history.
    return Object.freeze([...this.#applications]);
  }
}
