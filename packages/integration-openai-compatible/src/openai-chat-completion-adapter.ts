// Copyright © 2026 Mcont.

import type { TaskProtocolAdapter } from "@evolutos/mconet-core-spi";

import { buildOpenAIChatCompletionRequest } from "./build-chat-completion-request.js";
import { matchesTextChatInteractionMode } from "./match-interaction-mode.js";
import { matchesOpenAIChatCompletionsProtocol } from "./match-protocol-id.js";
import { matchesConversationGenerateTask } from "./match-task-type.js";
import { parseOpenAIChatCompletionError } from "./parse-chat-completion-error.js";
import { parseOpenAIChatCompletionResponse } from "./parse-chat-completion-response.js";
import {
  OPENAI_CHAT_REQUEST_TYPE_ID,
  OPENAI_CHAT_RESPONSE_TYPE_ID,
  prepareOpenAIChatCompletionPlan,
} from "./prepare-chat-completion-plan.js";

/** Diagnostic name of the default chat-completions adapter. */
const adapterName = "openai-chat-completions";

/** Descriptive version of this adapter implementation. */
const adapterVersion = "1.0.0";

/** Capabilities declared by this adapter. Unary chat adds none. */
const adapterCapabilities: TaskProtocolAdapter["descriptor"]["capabilities"] = new Set();

/**
 * Creates the chat-completions task adapter.
 *
 * The adapter matches protocol, task type, and a text mode. A model name does
 * not affect `supports`. The methods delegate to the existing planning, request,
 * response, and error functions. This object does not encode, authorize, or
 * send.
 *
 * @returns A new adapter with the same behavior as every other instance.
 */
export function createOpenAIChatCompletionAdapter(): TaskProtocolAdapter {
  return Object.freeze({
    descriptor: Object.freeze({
      name: adapterName,
      version: adapterVersion,
      capabilities: adapterCapabilities,
      source: "builtin" as const,
      typeContract: Object.freeze({
        inputTypeId: OPENAI_CHAT_REQUEST_TYPE_ID,
        outputTypeId: OPENAI_CHAT_RESPONSE_TYPE_ID,
      }),
    }),
    supports(input: Parameters<TaskProtocolAdapter["supports"]>[0]) {
      const protocolId = input.target?.protocolId;
      const taskType = input.task?.type;
      // All three fields are required. A model name is intentionally unread.
      return (
        typeof protocolId === "string" &&
        matchesOpenAIChatCompletionsProtocol(protocolId) &&
        typeof taskType === "string" &&
        matchesConversationGenerateTask(taskType) &&
        matchesTextChatInteractionMode(input.mode)
      );
    },
    preparePlan: prepareOpenAIChatCompletionPlan,
    buildRequest: buildOpenAIChatCompletionRequest,
    parseResponse: parseOpenAIChatCompletionResponse,
    parseError: parseOpenAIChatCompletionError,
  });
}
