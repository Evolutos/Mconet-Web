// Copyright © 2026 Mcont.

import type { IdGenerator } from "./id-generator.js";

/**
 * Generates a stable per-instance sequence for fixtures and contract tests.
 *
 * Every new instance starts at `id-1` and advances synchronously by one. The
 * sequence uses a private bigint counter so long-running test processes do not
 * lose integer precision. No global state, randomness, clock, reset control, or
 * caller-selected formatting can make the same call sequence nondeterministic.
 */
export class DeterministicIdGenerator implements IdGenerator {
  /** Next positive sequence number, hidden from reflection and consumers. */
  #nextSequence = 1n;

  /** Returns the next stable `id-{positive integer}` value. */
  public nextId(): string {
    // Snapshot the current value before advancing so the first call is id-1 and
    // every completed synchronous call consumes exactly one sequence position.
    const sequence = this.#nextSequence;
    this.#nextSequence += 1n;

    // Bigint interpolation is locale-independent and produces only decimal
    // digits, keeping fixture identifiers portable and byte-for-byte stable.
    return `id-${sequence}`;
  }
}
