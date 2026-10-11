// Copyright © 2026 Mcont.

import type { MessageRole } from "@evolutos/mconet-core-domain";

/** Portable identifier for the standard system participant. */
const systemMessageRoleId = "message.system";

/** Wire spelling for the system participant. Matching is exact and case-sensitive. */
const systemWireRole = "system";

/**
 * Shared system role read from a response.
 *
 * `rawValue` keeps the wire spelling. Standard identifiers carry their meaning,
 * so this role has no separate semantic guidance and no extension members.
 */
const systemMessageRole: MessageRole = Object.freeze({
  id: systemMessageRoleId,
  rawValue: systemWireRole,
  extensions: Object.freeze({}),
});

/**
 * Maps the standard system role to its wire spelling.
 *
 * Only `role.id` selects the spelling. `semantic` and `rawValue` are
 * descriptive and cannot turn another identifier into system.
 *
 * @param role Role of one request message entry.
 * @returns The wire spelling `system`.
 */
export function mapSystemMessageRoleToWire(role: MessageRole): typeof systemWireRole {
  // This branch owns only the system identifier. Other roles stay unmapped
  // until their own branches and the unknown-role policy are added.
  if (role.id !== systemMessageRoleId) {
    throw new TypeError("mapSystemMessageRoleToWire only maps message.system.");
  }
  return systemWireRole;
}

/**
 * Maps the system wire spelling back to the standard system role.
 *
 * @param spelling Exact `role` text of a response message.
 * @returns The standard system role, with `rawValue` set to that spelling.
 */
export function mapSystemWireRoleToDomain(spelling: string): MessageRole {
  // Case and surrounding whitespace are significant. This branch does not
  // coerce a different spelling into system.
  if (spelling !== systemWireRole) {
    throw new TypeError("mapSystemWireRoleToDomain only maps the system wire spelling.");
  }
  return systemMessageRole;
}
