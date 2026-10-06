// Copyright © 2026 Mcont.

/**
 * Opaque wrapper for a string credential or other sensitive text value.
 *
 * The plaintext is stored in an ECMAScript private slot, so it is not available
 * through an ordinary public property, enumeration, or object spread. Callers
 * must use {@link SecretValue.expose} and keep any revealed value within the
 * narrowest possible authorization operation. Stable redacted string, JSON,
 * inspection, and error representations belong to the dedicated safety step.
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
}
