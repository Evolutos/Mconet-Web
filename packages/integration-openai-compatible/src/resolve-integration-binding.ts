// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

import type { IntegrationTypeKey } from "./integration-type-key.js";
import type { IntegrationTypeTable } from "./integration-type-table.js";
import { matchIntegrationChain, type IntegrationChainMatcher } from "./match-integration-chain.js";
import { matchIntegrationType } from "./match-integration-type.js";
import type { ModelIntegrationBinding } from "./model-integration-binding.js";

/** Stable code when neither the type table nor the chain has a binding. */
const unsupportedIntegrationCode = "unsupported_integration";

/**
 * Resolves one binding from the type table and then the responsibility chain.
 *
 * The table is exact and runs first. The chain runs only after a table miss,
 * in its own order. A miss from both is an unsupported-integration error. No
 * model name is consulted and no nearby key is substituted.
 *
 * @param input Table, chain, and the key being resolved.
 * @returns The selected binding.
 * @throws ModelInteractionError When no binding matches.
 */
export function resolveIntegrationBinding(input: {
  readonly table: IntegrationTypeTable;
  readonly chain: readonly IntegrationChainMatcher[];
  readonly key: IntegrationTypeKey;
}): ModelIntegrationBinding {
  const fromTable = matchIntegrationType(input.table, input.key);
  if (fromTable !== undefined) {
    return fromTable;
  }
  const fromChain = matchIntegrationChain(input.chain, input.key);
  if (fromChain !== undefined) {
    return fromChain;
  }
  throw new ModelInteractionError({
    message: "No integration binding matches the protocol, task, and mode.",
    category: "unsupported_feature",
    phase: "resolution",
    code: unsupportedIntegrationCode,
    diagnostics: [],
  });
}
