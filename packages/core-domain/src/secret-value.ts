// Copyright © 2026 Mcont.

/** Stable replacement used by every non-explicit representation of a secret. */
const redactedSecretValue = "[REDACTED]";

/** Platform-neutral reference to Node's custom inspection protocol. */
const nodeInspectCustom = Symbol.for("nodejs.util.inspect.custom");

/**
 * Opaque wrapper for a string credential or other sensitive text value.
 *
 * The plaintext is stored in an ECMAScript private slot, so it is not available
 * through an ordinary public property, enumeration, or object spread. Callers
 * must use {@link SecretValue.expose} and keep any revealed value within the
 * narrowest possible authorization operation. All implicit representations use
 * one stable redacted value and never consult the private plaintext.
 */
export class SecretValue {
  readonly #value: string;

  /**
   * Wraps sensitive text without copying it into a public property.
   *
   * @param value Plaintext value to protect from ordinary property access.
   */
  public constructor(value: string) {
    // Store the plaintext only in a language-enforced private slot. No parallel
    // public field is created, so enumeration and spread cannot reveal it.
    this.#value = value;
  }

  /**
   * Supplies the plaintext to one synchronous, explicitly scoped consumer.
   *
   * The wrapper cannot prevent a consumer from retaining or returning plaintext;
   * authorization code invoking this method owns that responsibility, including
   * any asynchronous work started or returned by the synchronously invoked callback.
   *
   * @typeParam Result Result produced by the authorized consumer.
   * @param consumer Operation that requires the plaintext value.
   * @returns The consumer's result without storing it on the wrapper.
   */
  public expose<Result>(consumer: (value: string) => Result): Result {
    // Invoke exactly the supplied consumer with the private value and forward its
    // result directly; the wrapper does not cache the result or create another copy.
    return consumer(this.#value);
  }

  /**
   * Returns the stable redacted representation for explicit string conversion.
   *
   * @returns A fixed marker that contains no plaintext.
   */
  public toString(): string {
    // Return the module constant directly. Reading the private slot here would
    // create an avoidable path for plaintext to reach logs or error messages.
    return redactedSecretValue;
  }

  /**
   * Serializes the wrapper as a redacted string instead of an object or plaintext.
   *
   * @returns A fixed marker that is safe to include in JSON diagnostics.
   */
  public toJSON(): string {
    // Use the same fixed value as every other implicit representation so nested
    // JSON serialization cannot expose or produce a distinguishable secret value.
    return redactedSecretValue;
  }

  /**
   * Produces the redacted primitive used by interpolation and implicit coercion.
   *
   * @returns A fixed marker regardless of the caller's coercion hint.
   */
  public [Symbol.toPrimitive](): string {
    // Ignore the coercion hint deliberately: string, number, and default coercion
    // must all remain independent of the private plaintext.
    return redactedSecretValue;
  }

  /**
   * Produces a redacted value when inspected by Node-compatible diagnostics.
   *
   * @returns A fixed marker that contains no class internals or plaintext.
   */
  public [nodeInspectCustom](): string {
    // Return a primitive marker so the inspector has no wrapper fields or nested
    // values left to traverse after invoking the custom protocol.
    return redactedSecretValue;
  }
}
