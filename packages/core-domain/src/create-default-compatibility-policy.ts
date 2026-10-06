// Copyright © 2026 Mcont.

import type { CompatibilityPolicy } from "./compatibility-policy.js";

/**
 * Creates the compatibility policy used when no caller override is present.
 *
 * @returns A new frozen policy selecting the standard `compatible` mode.
 */
export function createDefaultCompatibilityPolicy(): CompatibilityPolicy {
  // Return a fresh frozen value so callers cannot mutate shared default state,
  // while every invocation retains deterministic compatible semantics.
  return Object.freeze({ mode: "compatible" });
}
