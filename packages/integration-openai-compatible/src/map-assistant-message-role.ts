// Copyright © 2026 Mcont.

import type { MessageRole } from "@evolutos/mconet-core-domain";

/** Portable identifier for the standard assistant participant. */
const assistantMessageRoleId = "message.assistant";

/** Wire spelling for the assistant participant. Matching is exact and case-sensitive. */
const assistantWireRole = "assistant";

/**
 * Shared assistant role read from a response.
 *
 * `rawValue` keeps the wire spelling. Standard identifiers carry their meaning,
 * so this role has no separate semantic guidance and no extension members.
 */
const assistantMessageRole: MessageRole = Object.freeze({
  id: assistantMessageRoleId,
  rawValue: assistantWireRole,
  extensions: Object.freeze({}),
});

/**
 * Maps the standard assistant role to its wire spelling.
 *
 * Only `role.id` selects the spelling. `semantic` and `rawValue` are
 * descriptive and cannot turn another identifier into assistant.
 *
 * @param role Role of one request message entry.
 * @returns The wire spelling `assistant`.
 */
export function mapAssistantMessageRoleToWire(role: MessageRole): typeof assistantWireRole {
  // This branch owns only the assistant identifier. Unknown roles stay unmapped
  // until the unknown-role policy is added.
  if (role.id !== assistantMessageRoleId) {
    throw new TypeError("mapAssistantMessageRoleToWire only maps message.assistant.");
  }
  return assistantWireRole;
}

/**
 * Maps the assistant wire spelling back to the standard assistant role.
 *
 * @param spelling Exact `role` text of a response message.
 * @returns The standard assistant role, with `rawValue` set to that spelling.
 */
export function mapAssistantWireRoleToDomain(spelling: string): MessageRole {
  // Case and surrounding whitespace are significant. This branch does not
  // coerce a different spelling into assistant.
  if (spelling !== assistantWireRole) {
    throw new TypeError("mapAssistantWireRoleToDomain only maps the assistant wire spelling.");
  }
  return assistantMessageRole;
}
