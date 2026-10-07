// Copyright © 2026 Mcont.

import type { Timestamp } from "@evolutos/mconet-core-domain";

/**
 * Minimal injectable source of the current portable UTC instant for tests.
 *
 * Consumers observe one immutable Timestamp per call without depending on Date,
 * timers, wall-clock APIs, advancement controls, or a concrete storage model.
 * Implementations decide whether time is real, fixed, or manually controlled.
 */
export interface Clock {
  /** Returns the implementation's current UTC instant. */
  now(): Timestamp;
}
