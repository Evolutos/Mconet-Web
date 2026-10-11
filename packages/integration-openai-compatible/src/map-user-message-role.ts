// Copyright © 2026 Mcont.

import type { MessageRole } from "@evolutos/mconet-core-domain";

/** Portable identifier for the standard user participant. */
const userMessageRoleId = "message.user";

/** Wire spelling for the user participant. Matching is exact and case-sensitive. */
const userWireRole = "user";

/**
 * Shared user role read from a response.
 *
 * `rawValue` keeps the wire spelling. Standard identifiers carry their meaning,
 * so this role has no separate semantic guidance and no extension members.
 */
const userMessageRole: MessageRole = Object.freeze({
  id: userMessageRoleId,
  rawValue: userWireRole,
  extensions: Object.freeze({}),
});

/**
 * Maps the standard user role to its wire spelling.
 *
 * Only `role.id` selects the spelling. `semantic` and `rawValue` are
 * descriptive and cannot turn another identifier into user.
 *
 * @param role Role of one request message entry.
 * @returns The wire spelling `user`.
 */
export function mapUserMessageRoleToWire(role: MessageRole): typeof userWireRole {
  // This branch owns only the user identifier. Other roles stay unmapped until
  // their own branches and the unknown-role policy are added.
  if (role.id !== userMessageRoleId) {
    throw new TypeError("mapUserMessageRoleToWire only maps message.user.");
  }
  return userWireRole;
}

/**
 * Maps the user wire spelling back to the standard user role.
 *
 * @param spelling Exact `role` text of a response message.
 * @returns The standard user role, with `rawValue` set to that spelling.
 */
export function mapUserWireRoleToDomain(spelling: string): MessageRole {
  // Case and surrounding whitespace are significant. This branch does not
  // coerce a different spelling into user.
  if (spelling !== userWireRole) {
    throw new TypeError("mapUserWireRoleToDomain only maps the user wire spelling.");
  }
  return userMessageRole;
}
