// Copyright © 2026 Mcont.

import type { MessageRequestMapper, TaskProtocolAdapter } from "@evolutos/mconet-core-spi";

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
 * send. An omitted message mapper keeps OpenAI `image_url` messages. A supplied
 * mapper replaces only that list; the protocol id is not used to choose it.
 *
 * @param input Optional injected message mapper. Omission keeps the default chat messages.
 * @returns A new adapter. Instances that share a mapper share that mapper.
 */
export function createOpenAIChatCompletionAdapter(input?: {
  readonly messageRequestMapper?: MessageRequestMapper;
}): TaskProtocolAdapter {
  const messageRequestMapper = input?.messageRequestMapper;
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
    buildRequest(buildInput: Parameters<TaskProtocolAdapter["buildRequest"]>[0]) {
      // Pass the injected mapper only when the caller supplied one. Omission
      // leaves the general image_url messages in place.
      return buildOpenAIChatCompletionRequest(
        messageRequestMapper === undefined ? buildInput : { ...buildInput, messageRequestMapper },
      );
    },
    parseResponse: parseOpenAIChatCompletionResponse,
    parseError: parseOpenAIChatCompletionError,
  });
}
