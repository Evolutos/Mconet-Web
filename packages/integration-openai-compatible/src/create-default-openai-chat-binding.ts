// Copyright © 2026 Mcont.

import type { ServiceAccess } from "@evolutos/mconet-core-domain";
import type { RuntimeComponent } from "@evolutos/mconet-core-spi";

import { CONVERSATION_GENERATE_TASK_TYPE } from "./match-task-type.js";
import { UNARY_INTERACTION_MODE_ID } from "./match-interaction-mode.js";
import { OPENAI_CHAT_COMPLETIONS_PROTOCOL_ID } from "./match-protocol-id.js";
import { createModelIntegrationBinding } from "./model-integration-binding.js";
import { createOpenAIChatCompletionAdapter } from "./openai-chat-completion-adapter.js";
import { createIntegrationTypeKey } from "./integration-type-key.js";

/** Label stored on the default chat-completions binding. */
export const OPENAI_CHAT_BINDING_ID = "binding.openai.chat.completions";

/** Version stored on the default chat-completions binding. */
export const OPENAI_CHAT_BINDING_VERSION = "1.0.0";

/**
 * Roles supplied by packages this integration is not allowed to import.
 *
 * Each list must be non-empty. The protocol adapter is not a parameter: the
 * default binding always uses the chat-completions adapter.
 */
export interface DefaultOpenAIChatBindingRoles {
  /** Authorization handlers, in candidate order. */
  readonly authorizationHandlers: readonly RuntimeComponent[];

  /** Payload encoders, in candidate order. */
  readonly payloadEncoders: readonly RuntimeComponent[];

  /** Payload decoders, in candidate order. */
  readonly payloadDecoders: readonly RuntimeComponent[];

  /** Transports, in candidate order. */
  readonly transports: readonly RuntimeComponent[];

  /** Optional access defaults. A credential source is not read. */
  readonly defaultServiceAccess?: ServiceAccess;
}

/**
 * Creates the default OpenAI-compatible chat binding.
 *
 * The key is `openai.chat.completions`, `conversation.generate`, and `unary`.
 * The protocol adapter, authorization handlers, encoders, decoders, and
 * transports are all present. An empty role list fails instead of producing a
 * binding that looks complete. Nothing is registered in a type table.
 *
 * @param roles Component roles owned outside this package.
 * @returns The frozen binding.
 * @throws TypeError When a role list is empty.
 */
export function createDefaultOpenAIChatBinding(
  roles: DefaultOpenAIChatBindingRoles,
): ReturnType<typeof createModelIntegrationBinding> {
  requireRole(roles.authorizationHandlers, "authorizationHandlers");
  requireRole(roles.payloadEncoders, "payloadEncoders");
  requireRole(roles.payloadDecoders, "payloadDecoders");
  requireRole(roles.transports, "transports");
  return createModelIntegrationBinding({
    key: createIntegrationTypeKey({
      protocolId: OPENAI_CHAT_COMPLETIONS_PROTOCOL_ID,
      taskType: CONVERSATION_GENERATE_TASK_TYPE,
      modeId: UNARY_INTERACTION_MODE_ID,
    }),
    bindingId: OPENAI_CHAT_BINDING_ID,
    bindingVersion: OPENAI_CHAT_BINDING_VERSION,
    taskProtocolAdapter: createOpenAIChatCompletionAdapter(),
    authorizationHandlers: roles.authorizationHandlers,
    payloadEncoders: roles.payloadEncoders,
    payloadDecoders: roles.payloadDecoders,
    transports: roles.transports,
    ...(roles.defaultServiceAccess === undefined
      ? {}
      : { defaultServiceAccess: roles.defaultServiceAccess }),
    extensions: {},
  });
}

/**
 * Rejects a missing role list.
 *
 * @param values Candidate components.
 * @param name Role name used in the failure.
 */
function requireRole(values: readonly RuntimeComponent[], name: string): void {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError(`Default OpenAI chat binding requires ${name}.`);
  }
}
