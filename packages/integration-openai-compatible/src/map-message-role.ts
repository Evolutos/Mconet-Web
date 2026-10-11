// Copyright © 2026 Mcont.

import { ModelInteractionError, type MessageRole } from "@evolutos/mconet-core-domain";

import {
  mapAssistantMessageRoleToWire,
  mapAssistantWireRoleToDomain,
} from "./map-assistant-message-role.js";
import {
  mapSystemMessageRoleToWire,
  mapSystemWireRoleToDomain,
} from "./map-system-message-role.js";
import { mapUserMessageRoleToWire, mapUserWireRoleToDomain } from "./map-user-message-role.js";
import { invalidProtocolResponse } from "./wire.js";

/** Stable code for a request role the protocol has no spelling for. */
const unsupportedMessageRoleCode = "unsupported_message_role";

/**
 * Response spellings this protocol accepts, in a stable order.
 *
 * The order is alphabetical so failure text does not depend on which branch
 * was checked last.
 */
const supportedWireRoles = "assistant, system, or user";

/**
 * Returns the wire spelling for one request message role.
 *
 * Only `role.id` selects the spelling. `semantic` and `rawValue` never turn an
 * unknown identifier into system, user, or assistant.
 *
 * @param role Role of one request message entry.
 * @returns `system`, `user`, or `assistant`.
 */
export function mapMessageRoleToWire(role: MessageRole): "assistant" | "system" | "user" {
  if (role.id === "message.system") {
    return mapSystemMessageRoleToWire(role);
  }
  if (role.id === "message.user") {
    return mapUserMessageRoleToWire(role);
  }
  if (role.id === "message.assistant") {
    return mapAssistantMessageRoleToWire(role);
  }
  // The identifier is SDK-side request data, so naming it tells the caller
  // which entry needs a different role. Descriptive fields are not a fallback.
  const roleId = typeof role.id === "string" ? role.id : "";
  throw new ModelInteractionError({
    message: `Message role ${roleId} is not supported by the OpenAI-compatible chat completions protocol.`,
    category: "unsupported_feature",
    phase: "protocol_adaptation",
    code: unsupportedMessageRoleCode,
    diagnostics: [],
  });
}

/**
 * Returns the standard role for one response message wire spelling.
 *
 * Matching is exact and case-sensitive. An unknown spelling is a protocol
 * failure; this protocol does not substitute another role.
 *
 * @param spelling Exact `role` text of a response message.
 * @param path JSON Pointer of the role member, used only in failure messages.
 * @returns A standard role whose `rawValue` is `spelling`.
 */
export function mapWireRoleToDomain(spelling: string, path: string): MessageRole {
  if (spelling === "system") {
    return mapSystemWireRoleToDomain(spelling);
  }
  if (spelling === "user") {
    return mapUserWireRoleToDomain(spelling);
  }
  if (spelling === "assistant") {
    return mapAssistantWireRoleToDomain(spelling);
  }
  throw invalidProtocolResponse(path, `must be ${supportedWireRoles}`);
}
