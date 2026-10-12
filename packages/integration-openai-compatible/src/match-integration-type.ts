// Copyright © 2026 Mcont.

import type { IntegrationTypeKey } from "./integration-type-key.js";
import type { IntegrationTypeTable } from "./integration-type-table.js";
import type { ModelIntegrationBinding } from "./model-integration-binding.js";
import { serializeIntegrationTypeKey } from "./serialize-integration-type-key.js";

/**
 * Returns the binding stored under the exact protocol, task, and mode.
 *
 * A prefix, a different mode, or a model name is not a match. The function does
 * not walk a chain and does not create a binding for a miss.
 *
 * @param table Type table built from bindings.
 * @param key Protocol, task type, and mode to find.
 * @returns The stored binding, or `undefined` when the key is absent.
 */
export function matchIntegrationType(
  table: IntegrationTypeTable,
  key: IntegrationTypeKey,
): ModelIntegrationBinding | undefined {
  return table.get(serializeIntegrationTypeKey(key));
}
