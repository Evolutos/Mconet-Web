// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

import type { ModelIntegrationBinding } from "./model-integration-binding.js";
import { serializeIntegrationTypeKey } from "./serialize-integration-type-key.js";

/** Stable code when two bindings use the same protocol, task, and mode. */
const duplicateIntegrationTypeCode = "duplicate_integration_type";

/**
 * Immutable exact-key table of integration bindings.
 *
 * The table is built once. It has no add or replace operation, and it does not
 * select a binding by model name.
 */
export class IntegrationTypeTable {
  /** Bindings keyed by the serialized protocol, task, and mode. */
  readonly #bindings: ReadonlyMap<string, ModelIntegrationBinding>;

  /** Number of bindings accepted at construction. */
  public readonly size: number;

  /**
   * Stores a finished binding map.
   *
   * @param bindings Bindings already checked for duplicate keys.
   */
  public constructor(bindings: ReadonlyMap<string, ModelIntegrationBinding>) {
    this.#bindings = bindings;
    this.size = bindings.size;
    Object.freeze(this);
  }

  /**
   * Returns the binding stored for an exact key.
   *
   * This is available to later matching steps. It does not create bindings.
   *
   * @param serializedKey Serialized protocol, task, and mode.
   * @returns The binding, or `undefined` when the key is absent.
   */
  public get(serializedKey: string): ModelIntegrationBinding | undefined {
    return this.#bindings.get(serializedKey);
  }
}

/**
 * Builds a frozen type table.
 *
 * A repeated protocol, task, and mode fails immediately. The failure does not
 * keep a partial table, and it does not choose one of the duplicates.
 *
 * @param bindings Bindings in caller order.
 * @returns The frozen table.
 * @throws ModelInteractionError When two bindings serialize to the same key.
 */
export function createIntegrationTypeTable(
  bindings: readonly ModelIntegrationBinding[],
): IntegrationTypeTable {
  if (!Array.isArray(bindings)) {
    throw new TypeError("Integration type table bindings must be an array.");
  }
  const stored = new Map<string, ModelIntegrationBinding>();
  for (const binding of bindings) {
    const serializedKey = serializeIntegrationTypeKey(binding.key);
    if (stored.has(serializedKey)) {
      throw new ModelInteractionError({
        message: "Integration type table contains a duplicate key.",
        category: "invalid_component_configuration",
        phase: "resolution",
        code: duplicateIntegrationTypeCode,
        diagnostics: [],
      });
    }
    stored.set(serializedKey, binding);
  }
  return new IntegrationTypeTable(stored);
}
