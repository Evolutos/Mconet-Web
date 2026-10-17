// Copyright © 2026 Mcont.

import type { MessageRole } from "@evolutos/mconet-core-domain";

/** Portable identifier for the standard tool-result participant. */
const toolMessageRoleId = "message.tool";

/** Wire spelling for a tool result. Matching is exact and case-sensitive. */
const toolWireRole = "tool";

/**
 * Shared tool role read from a response.
 *
 * `rawValue` keeps the wire spelling. The call id lives on the message entry,
 * not on this role.
 */
const toolMessageRole: MessageRole = Object.freeze({
  id: toolMessageRoleId,
  rawValue: toolWireRole,
  extensions: Object.freeze({}),
});

/**
 * Maps the standard tool role to its wire spelling.
 *
 * Only `role.id` selects the spelling. `semantic` and `rawValue` cannot turn
 * another identifier into a tool result.
 *
 * @param role Role of one request message entry.
 * @returns The wire spelling `tool`.
 */
export function mapToolMessageRoleToWire(role: MessageRole): typeof toolWireRole {
  // Only the standard tool identifier selects this spelling. Another role's
  // raw value cannot borrow it.
  if (role.id !== toolMessageRoleId) {
    throw new TypeError("mapToolMessageRoleToWire only maps message.tool.");
  }
  return toolWireRole;
}

/**
 * Maps the tool wire spelling back to the standard tool role.
 *
 * @param spelling Exact `role` text of a response message.
 * @returns The standard tool role, with `rawValue` set to that spelling.
 */
export function mapToolWireRoleToDomain(spelling: string): MessageRole {
  // Matching is exact. A different spelling, including a different case, is
  // not a tool result.
  if (spelling !== toolWireRole) {
    throw new TypeError("mapToolWireRoleToDomain only maps the tool wire spelling.");
  }
  // The shared frozen role keeps rawValue equal to the accepted spelling.
  return toolMessageRole;
}
