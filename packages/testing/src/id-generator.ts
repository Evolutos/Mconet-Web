// Copyright © 2026 Mcont.

/**
 * Minimal injectable identity source used by deterministic test infrastructure.
 *
 * Callers can request the next opaque string without learning how identities are
 * seeded, formatted, synchronized, or stored. Concrete generators own sequence
 * policy and state; this abstraction exposes no reset or observation behavior.
 */
export interface IdGenerator {
  /** Returns the next identity in the concrete generator's sequence. */
  nextId(): string;
}
