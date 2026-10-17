// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type { ModelIntegrationPlan, ModelIntegrationResolver } from "@evolutos/mconet-core-spi";
import {
  createOpenAIChatCompletionAdapter,
  matchesConversationGenerateTask,
  matchesOpenAIChatCompletionsProtocol,
  matchesTextChatInteractionMode,
  OPENAI_CHAT_BINDING_ID,
  OPENAI_CHAT_BINDING_VERSION,
} from "@evolutos/mconet-integration-openai-compatible";

/** Diagnostic name of the chat integration resolver. */
const resolverName = "openai-chat-integration-resolver";

/** Descriptive version of this resolver implementation. */
const resolverVersion = "1.0.0";

/** Stable code when the target protocol, task, and mode have no binding. */
const unsupportedIntegrationCode = "unsupported_integration";

/** Matcher score for the one exact protocol, task, and mode match. */
const exactMatchScore = 1;

/**
 * Selects the chat-completions binding from the call's model target.
 *
 * The target `protocolId` is the selector, together with the task type and the
 * interaction mode. The model name is not read, so a vendor model spelling
 * cannot choose or reject this binding. A direct adapter still bypasses this
 * resolver when the caller supplies one.
 *
 * @returns A resolver that yields the chat adapter for a matching target.
 */
export function createOpenAIChatIntegrationResolver(): ModelIntegrationResolver {
  const adapter = createOpenAIChatCompletionAdapter();
  return {
    descriptor: Object.freeze({
      name: resolverName,
      version: resolverVersion,
      capabilities: new Set<string>(),
      source: "builtin" as const,
    }),
    resolve(input) {
      const protocolId = input.target.protocolId;
      const taskType = input.task.type;
      if (
        typeof protocolId !== "string" ||
        !matchesOpenAIChatCompletionsProtocol(protocolId) ||
        typeof taskType !== "string" ||
        !matchesConversationGenerateTask(taskType) ||
        !matchesTextChatInteractionMode(input.mode)
      ) {
        throw unsupportedIntegration();
      }
      const match = Object.freeze({
        target: Object.freeze({
          matched: true,
          score: exactMatchScore,
          diagnostics: Object.freeze([]),
        }),
        task: Object.freeze({
          matched: true,
          score: exactMatchScore,
          diagnostics: Object.freeze([]),
        }),
      });
      const plan: ModelIntegrationPlan = {
        source: "resolved_binding",
        bindingId: OPENAI_CHAT_BINDING_ID,
        bindingVersion: OPENAI_CHAT_BINDING_VERSION,
        match,
        taskProtocolAdapter: adapter,
        authorizationHandlers: Object.freeze([]),
        payloadEncoders: Object.freeze([]),
        payloadDecoders: Object.freeze([]),
        transports: Object.freeze([]),
        extensions: Object.freeze({}),
      };
      return Object.freeze(plan);
    },
  };
}

/**
 * Creates the failure for a target this client cannot bind.
 *
 * The message does not include the protocol id, model name, or request text.
 *
 * @returns The unsupported-integration error.
 */
function unsupportedIntegration(): ModelInteractionError {
  return new ModelInteractionError({
    message: "No integration binding matches the protocol, task, and mode.",
    category: "unsupported_feature",
    phase: "resolution",
    code: unsupportedIntegrationCode,
    diagnostics: [
      {
        code: unsupportedIntegrationCode,
        severity: "error",
        phase: "resolution",
        message: "The model target did not select a supported integration.",
      },
    ],
  });
}
