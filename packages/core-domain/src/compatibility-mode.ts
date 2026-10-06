// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Policy mode controlling how integrations handle unknown or lossy data.
 *
 * The three listed literals form the SDK's standard compatibility vocabulary.
 * The open identifier arm lets integrations and future SDK versions introduce
 * additional modes while preserving editor completion for the standard values.
 * Runtime inputs still require validation at their trust boundary because this
 * type defines representation only and does not validate arbitrary strings.
 */
export type CompatibilityMode =
  "strict" | "compatible" | "permissive" | (OpenIdentifier & Record<never, never>);
