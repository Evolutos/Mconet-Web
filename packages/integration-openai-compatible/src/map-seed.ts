// Copyright © 2026 Mcont.

import type { ProcessingResult } from "@evolutos/mconet-core-domain";

/** Stable code when a seed cannot be sent unchanged. */
const unsupportedSeedCode = "unsupported_seed";

/**
 * Seed member to place on a request, or an empty result when it is omitted.
 *
 * `seed` is absent when the caller did not set one. A present seed is copied
 * exactly, including zero and negative integers.
 */
export interface MappedSeed {
  /** Deterministic seed to send, absent when the request should leave the service default. */
  readonly seed?: number;
}

/**
 * Maps one generation seed onto the chat-completions `seed` field.
 *
 * An omitted seed stays omitted. A safe integer is copied exactly. A fraction,
 * non-finite number, negative zero, or integer JSON cannot preserve is
 * unsupported: it is rejected and is not rounded to a nearby integer.
 *
 * @param seed Caller seed, or `undefined` when the control was omitted.
 * @returns The request member, or an error diagnostic and no value.
 */
export function mapSeedToWire(seed: number | undefined): ProcessingResult<MappedSeed> {
  // Omission is not seed zero. The request leaves the service default in place.
  if (seed === undefined) {
    return { value: Object.freeze({}), diagnostics: [] };
  }
  if (isSendableSeed(seed)) {
    return { value: Object.freeze({ seed }), diagnostics: [] };
  }

  return {
    diagnostics: [
      {
        code: unsupportedSeedCode,
        severity: "error",
        phase: "planning",
        message: "Seed is not a safe integer and was not rounded.",
        path: "seed",
      },
    ],
  };
}

/**
 * Returns whether a seed can be written without rounding or sign loss.
 *
 * @param seed Candidate seed.
 * @returns Whether it is a safe integer other than negative zero.
 */
function isSendableSeed(seed: number): boolean {
  // Negative zero would survive `Number.isSafeInteger` but is not a stable JSON
  // integer, so it stays in the unsupported path.
  return typeof seed === "number" && Number.isSafeInteger(seed) && !Object.is(seed, -0);
}
