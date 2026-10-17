// Copyright © 2026 Mcont.

import type { ModelOutput } from "@evolutos/mconet-core-domain";

/** One text fragment from a server-stream response. */
export interface TextStreamEvent {
  /** Newly decoded assistant text. Earlier fragments are not repeated. */
  readonly text: string;
}

/**
 * Incremental text plus the final assembled output.
 *
 * `events` and `output` share one read of the response. Waiting on `output`
 * does not require the caller to drain `events`.
 */
export interface TextStreamInteraction {
  /** Text fragments in arrival order. */
  readonly events: AsyncIterable<TextStreamEvent>;

  /** Assembled output, settled when the response has been read. */
  readonly output: Promise<ModelOutput>;
}

/** Queue of text fragments that does not block the response reader. */
export interface TextStreamQueue {
  /** Adds one fragment. A waiting reader receives it immediately. */
  push(text: string): void;

  /** Marks a successful end after the last fragment. */
  close(): void;

  /** Marks a failure. The next read rejects. */
  fail(error: unknown): void;

  /** Reader for fragments pushed so far and those that arrive later. */
  readonly events: AsyncIterable<TextStreamEvent>;
}

/**
 * Creates a bounded text queue.
 *
 * Unread fragments are kept. A long backlog is joined into one fragment so the
 * queue cannot grow without a limit while the final output is still produced.
 *
 * @returns The queue and its async iterable.
 */
export function createTextStreamQueue(): TextStreamQueue {
  const pending: string[] = [];
  let closed = false;
  let failure: unknown;
  let waiting:
    | {
        resolve: (result: IteratorResult<TextStreamEvent>) => void;
        reject: (error: unknown) => void;
      }
    | undefined;

  const deliver = () => {
    if (waiting === undefined) {
      return;
    }
    const current = waiting;
    waiting = undefined;
    if (failure !== undefined) {
      current.reject(failure);
      return;
    }
    const text = pending.shift();
    if (text !== undefined) {
      current.resolve({ value: { text }, done: false });
      return;
    }
    if (closed) {
      current.resolve({ value: undefined, done: true });
    }
  };

  return {
    push(text) {
      if (closed || failure !== undefined || text.length === 0) {
        return;
      }
      pending.push(text);
      if (pending.length > 32) {
        const joined = pending.splice(0).join("");
        pending.push(joined);
      }
      deliver();
    },
    close() {
      closed = true;
      deliver();
    },
    fail(error) {
      failure = error;
      closed = true;
      deliver();
    },
    events: {
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<IteratorResult<TextStreamEvent>> {
            const text = pending.shift();
            if (text !== undefined) {
              return Promise.resolve({ value: { text }, done: false });
            }
            if (failure !== undefined) {
              return Promise.reject(failure);
            }
            if (closed) {
              return Promise.resolve({ value: undefined, done: true });
            }
            return new Promise((resolve, reject) => {
              waiting = { resolve, reject };
            });
          },
        };
      },
    },
  };
}
