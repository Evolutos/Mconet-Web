// Copyright © 2026 Mcont.

import type { Diagnostic } from "./diagnostic.js";

/**
 * Value and diagnostics produced by one non-throwing processing stage.
 *
 * A value may be absent when a stage cannot produce a usable result, while the
 * diagnostics collection is always present and may be empty. This contract does
 * not decide whether warning or error diagnostics permit execution to continue;
 * the caller's compatibility policy owns that decision.
 *
 * @typeParam Value Successfully produced stage value.
 */
export interface ProcessingResult<Value> {
  /** Optional successfully produced value; absence means no usable value was produced. */
  readonly value?: Value;

  /** Immutable diagnostics emitted while attempting to produce the value. */
  readonly diagnostics: readonly Diagnostic[];
}
