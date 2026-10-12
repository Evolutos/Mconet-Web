// Copyright © 2026 Mcont.

import type { ConversationTaskResult, ParsedTaskResponse } from "@evolutos/mconet-core-domain";
import type { ErasedRuntimeValue, TransportResponseMetadata } from "@evolutos/mconet-core-spi";

/** Decoded success body for the stable success fixture. */
export const openAIChatFixtureSuccessBody = Object.freeze({
  id: "resp-fixture",
  model: "fixture-model",
  choices: Object.freeze([
    Object.freeze({
      index: 0,
      message: Object.freeze({ role: "assistant", content: "hello" }),
      finish_reason: "stop",
    }),
  ]),
  usage: Object.freeze({ prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }),
  system_fingerprint: "fp",
});

/** Transport metadata that selects success parsing. */
export const openAIChatFixtureSuccessMetadata: TransportResponseMetadata = {
  outcome: "success",
  statusCode: 200,
  headers: [],
  extensions: {},
};

/**
 * Payload envelope around the success fixture body.
 *
 * The type id is the chat-completions success port. The JSON decoder's generic
 * `json.value` identity is not accepted by success parsing.
 */
export const openAIChatFixtureSuccessPayload: ErasedRuntimeValue = {
  typeId: "protocol.openai.chat-response",
  value: openAIChatFixtureSuccessBody,
};

/** Parsed response the success fixture must produce. */
export const openAIChatFixtureParsedResponse: ParsedTaskResponse = {
  result: {
    descriptor: { type: "conversation.generate", metadata: {}, extensions: {} },
    document: {
      version: "1.0",
      root: {
        id: "result-root",
        kind: "task.root",
        composition: "container",
        children: [],
        relations: [],
        metadata: {},
        extensions: {},
      },
      metadata: {},
      extensions: {},
    },
    messages: {
      version: "1.0",
      purpose: "output",
      root: {
        id: "output",
        kind: "message.root",
        composition: "container",
        children: [
          {
            id: "choice-0",
            kind: "message.entry",
            role: { id: "message.assistant", rawValue: "assistant", extensions: {} },
            content: [
              {
                id: "choice-0-text",
                kind: "content.text",
                text: "hello",
                metadata: {},
                extensions: {},
              },
            ],
            relations: [],
            metadata: {},
            extensions: {},
          },
        ],
        relations: [],
        metadata: {},
        extensions: {},
      },
      metadata: {},
      extensions: {},
    },
    artifacts: { artifacts: [] },
    metadata: {},
    extensions: {},
  } as ConversationTaskResult,
  resolvedModel: { name: "fixture-model", metadata: {}, extensions: {} },
  status: "completed",
  stopReason: "stop",
  usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3, extensions: {} },
  protocolState: [],
  extensions: { system_fingerprint: "fp" },
};
