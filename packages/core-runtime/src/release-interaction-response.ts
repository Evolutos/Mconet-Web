// Copyright © 2026 Mcont.

/**
 * Runs one response operation and then releases its resources.
 *
 * Release runs after success and after failure, including a decode rejection.
 * The operation's result or exception is preserved when release succeeds. This
 * stage does not decode by itself and does not choose a decoder.
 *
 * @typeParam Result Value produced by the operation.
 * @param input Operation that uses the response, and the release callback.
 * @returns The operation's value.
 */
export async function releaseInteractionResponse<Result>(input: {
  readonly operation: () => Promise<Result>;
  readonly release: () => void | Promise<void>;
}): Promise<Result> {
  try {
    return await input.operation();
  } finally {
    // Decode failure must not skip release. A release rejection surfaces after
    // the operation has already settled.
    await input.release();
  }
}
