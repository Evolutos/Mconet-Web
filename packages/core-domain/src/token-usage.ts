// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";

/**
 * Immutable protocol-neutral token accounting reported by a model service.
 *
 * Each standard count is independently optional, preserving the distinction
 * between an omitted field and an explicitly reported zero. `totalTokens` is a
 * provider fact rather than a computed sum because cached, reasoning, or future
 * categories may contribute. Extensions retain portable provider breakdowns.
 */
export interface TokenUsage {
  /** Optional number of input tokens explicitly reported by the provider. */
  readonly inputTokens?: number;

  /** Optional number of output tokens explicitly reported by the provider. */
  readonly outputTokens?: number;

  /** Optional provider total preserved independently from component counts. */
  readonly totalTokens?: number;

  /** Always-present provider-specific usage data with portable JSON values. */
  readonly extensions: Extensions;
}
