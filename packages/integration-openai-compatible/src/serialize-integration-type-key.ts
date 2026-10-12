// Copyright © 2026 Mcont.

import { createIntegrationTypeKey, type IntegrationTypeKey } from "./integration-type-key.js";

/**
 * Serializes an integration key to a stable lookup string.
 *
 * The encoding is a JSON array of protocol id, task type, and mode id, in that
 * order. Open identifiers can contain commas and colons, so those characters
 * are not used as separators. A model name is not read and cannot appear unless
 * it was already one of the three key fields.
 *
 * @param key Integration key, including a value that carries extra fields.
 * @returns The same text for the same three fields.
 */
export function serializeIntegrationTypeKey(key: IntegrationTypeKey): string {
  // Rebuild the key so an extra model field cannot become a fourth array slot.
  const checked = createIntegrationTypeKey(key);
  return JSON.stringify([checked.protocolId, checked.taskType, checked.modeId]);
}
