// Copyright © 2026 Mcont.

import type { IntegrationTypeKey } from "./integration-type-key.js";
import type { ModelIntegrationBinding } from "./model-integration-binding.js";

/**
 * One explicit chain step.
 *
 * A step returns a binding when it claims the key, or `undefined` when the next
 * step should run. Steps do not receive a model name.
 */
export type IntegrationChainMatcher = (
  key: IntegrationTypeKey,
) => ModelIntegrationBinding | undefined;

/**
 * Walks matchers in the given order and returns the first binding.
 *
 * The array order is the chain order. Matchers are not sorted, and a later
 * matcher is not called after an earlier one returns a binding. An empty chain
 * or a chain of misses returns `undefined`.
 *
 * @param matchers Matchers in caller order.
 * @param key Protocol, task type, and mode being resolved.
 * @returns The first binding, or `undefined` when every matcher misses.
 */
export function matchIntegrationChain(
  matchers: readonly IntegrationChainMatcher[],
  key: IntegrationTypeKey,
): ModelIntegrationBinding | undefined {
  if (!Array.isArray(matchers)) {
    throw new TypeError("Integration chain matchers must be an array.");
  }
  for (const matcher of matchers) {
    const binding = matcher(key);
    if (binding !== undefined) {
      return binding;
    }
  }
  return undefined;
}
