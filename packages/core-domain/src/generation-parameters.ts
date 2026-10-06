// Copyright © 2026 Mcont.

/**
 * Immutable protocol-neutral controls for one model-generation Task.
 *
 * Every field is independently optional so callers can express only the
 * controls they selected. Protocol adapters decide how supported controls map
 * to target requests under the active compatibility policy. Numeric ranges,
 * integer bounds, and stop-sequence content belong to the later dedicated
 * validator; this interface defines storage shape without normalizing values.
 */
export interface GenerationParameters {
  /** Optional sampling temperature retained independently from top-p. */
  readonly temperature?: number;

  /** Optional nucleus-sampling probability retained independently. */
  readonly topP?: number;

  /** Optional maximum number of tokens requested for generated output. */
  readonly maxOutputTokens?: number;

  /** Optional ordered stop sequences retained without provider mapping. */
  readonly stop?: readonly string[];

  /** Optional deterministic sampling seed when supported by the target. */
  readonly seed?: number;
}
