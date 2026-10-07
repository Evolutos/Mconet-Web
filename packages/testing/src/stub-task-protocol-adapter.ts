// Copyright © 2026 Mcont.

import type { TaskProtocolAdapter } from "@evolutos/mconet-core-spi";

/**
 * Configurable test double for the complete synchronous TaskProtocolAdapter boundary.
 *
 * Every adapter method delegates to one constructor-supplied handler with the
 * original input identity. Handlers independently choose a normal result, an
 * unusable processing result, or a thrown failure. The stub does not synthesize
 * plans, validate protocol semantics, record calls, or translate exceptions.
 */
export class StubTaskProtocolAdapter implements TaskProtocolAdapter {
  /** Immutable component metadata exposed through the SPI boundary. */
  public readonly descriptor: TaskProtocolAdapter["descriptor"];

  /** Configured target/task/mode support behavior. */
  readonly #supports: TaskProtocolAdapter["supports"];

  /** Configured execution-planning behavior. */
  readonly #preparePlan: TaskProtocolAdapter["preparePlan"];

  /** Configured unencoded-request construction behavior. */
  readonly #buildRequest: TaskProtocolAdapter["buildRequest"];

  /** Configured successful-response parsing behavior. */
  readonly #parseResponse: TaskProtocolAdapter["parseResponse"];

  /** Configured service-error classification behavior. */
  readonly #parseError: TaskProtocolAdapter["parseError"];

  /**
   * Captures one complete set of independent adapter method handlers.
   *
   * @param configuration Descriptor and exact behavior for every SPI method.
   */
  public constructor(configuration: {
    readonly descriptor: TaskProtocolAdapter["descriptor"];
    readonly supports: TaskProtocolAdapter["supports"];
    readonly preparePlan: TaskProtocolAdapter["preparePlan"];
    readonly buildRequest: TaskProtocolAdapter["buildRequest"];
    readonly parseResponse: TaskProtocolAdapter["parseResponse"];
    readonly parseError: TaskProtocolAdapter["parseError"];
  }) {
    // Copy each reference once so later mutation of a JavaScript configuration
    // object cannot silently change the already-created test double.
    this.descriptor = configuration.descriptor;
    this.#supports = configuration.supports;
    this.#preparePlan = configuration.preparePlan;
    this.#buildRequest = configuration.buildRequest;
    this.#parseResponse = configuration.parseResponse;
    this.#parseError = configuration.parseError;
  }

  /** Delegates support matching to the configured handler. */
  public supports(
    input: Parameters<TaskProtocolAdapter["supports"]>[0],
  ): ReturnType<TaskProtocolAdapter["supports"]> {
    // Forward the exact labelled input and preserve either the boolean result or
    // the original thrown value without matching on behalf of the test.
    return this.#supports(input);
  }

  /** Delegates deterministic plan preparation to the configured handler. */
  public preparePlan(
    input: Parameters<TaskProtocolAdapter["preparePlan"]>[0],
  ): ReturnType<TaskProtocolAdapter["preparePlan"]> {
    // The handler may return a plan, return diagnostics without a usable value,
    // or throw; the stub preserves that outcome exactly.
    return this.#preparePlan(input);
  }

  /** Delegates unencoded request construction to the configured handler. */
  public buildRequest(
    input: Parameters<TaskProtocolAdapter["buildRequest"]>[0],
  ): ReturnType<TaskProtocolAdapter["buildRequest"]> {
    // Keep the original request and plan identities intact so a test can inspect
    // or reject them inside its handler.
    return this.#buildRequest(input);
  }

  /** Delegates successful decoded-payload parsing to the configured handler. */
  public parseResponse(
    input: Parameters<TaskProtocolAdapter["parseResponse"]>[0],
  ): ReturnType<TaskProtocolAdapter["parseResponse"]> {
    // Forward decoded payload and transport evidence together without cloning,
    // narrowing, or constructing a public output envelope.
    return this.#parseResponse(input);
  }

  /** Delegates service-error classification to the configured handler. */
  public parseError(
    input: Parameters<TaskProtocolAdapter["parseError"]>[0],
  ): ReturnType<TaskProtocolAdapter["parseError"]> {
    // Preserve the configured ModelInteractionError identity or any injected
    // thrown failure; no wrapping or category translation occurs in the stub.
    return this.#parseError(input);
  }
}
