// Copyright © 2026 Mcont.

/**
 * Runs one parse operation and then releases the interaction context.
 *
 * Release runs after a successful parse and after a parse rejection. The
 * operation's result or exception is preserved when release succeeds. This
 * stage does not parse a payload by itself.
 *
 * @typeParam Result Value produced by the parse operation.
 * @param input Parse operation and the context-release callback.
 * @returns The parse operation's value.
 */
export async function releaseInteractionContext<Result>(input: {
  readonly operation: () => Promise<Result>;
  readonly release: () => void | Promise<void>;
}): Promise<Result> {
  try {
    return await input.operation();
  } finally {
    // A parse failure must not leave the interaction context retained.
    await input.release();
  }
}
