// Copyright © 2026 Mcont.

import type { ProtocolRequestPlan } from "@evolutos/mconet-core-spi";

import { defineTaskProtocolAdapterContract } from "../../testing/src/task-protocol-adapter-contract.js";
import { createOpenAIChatCompletionAdapter } from "./openai-chat-completion-adapter.js";
import {
  createOpenAIChatFixtureError,
  openAIChatFixtureErrorMetadata,
  openAIChatFixtureErrorPayload,
} from "./openai-chat-error.fixture.js";
import {
  createOpenAIChatFixtureRequest,
  openAIChatFixtureMode,
  openAIChatFixturePlan,
  openAIChatFixturePolicy,
  openAIChatFixtureRequestBody,
} from "./openai-chat-request.fixture.js";
import {
  openAIChatFixtureParsedResponse,
  openAIChatFixtureSuccessMetadata,
  openAIChatFixtureSuccessPayload,
} from "./openai-chat-success.fixture.js";

const requestPlan: ProtocolRequestPlan = {
  payload: {
    typeId: "protocol.openai.chat-request",
    value: openAIChatFixtureRequestBody,
  },
  executionPlan: openAIChatFixturePlan,
};

/**
 * Registers the shared adapter contract for chat completions.
 *
 * Each case receives a new adapter and a new request. The expected plan, body,
 * parsed response, and authentication error come from the stable fixtures.
 */
defineTaskProtocolAdapterContract("OpenAIChatCompletionAdapter", () => {
  const request = createOpenAIChatFixtureRequest();
  return {
    adapter: createOpenAIChatCompletionAdapter(),
    support: {
      input: {
        target: request.target,
        task: request.task.descriptor,
        mode: openAIChatFixtureMode,
      },
      expected: true,
    },
    plan: {
      input: { request, mode: openAIChatFixtureMode, policy: openAIChatFixturePolicy },
      expected: { diagnostics: [], value: openAIChatFixturePlan },
    },
    request: {
      input: { request, plan: openAIChatFixturePlan },
      expected: { diagnostics: [], value: requestPlan },
    },
    response: {
      input: {
        payload: openAIChatFixtureSuccessPayload,
        metadata: openAIChatFixtureSuccessMetadata,
      },
      expected: { diagnostics: [], value: openAIChatFixtureParsedResponse },
    },
    error: {
      input: {
        payload: openAIChatFixtureErrorPayload,
        metadata: openAIChatFixtureErrorMetadata,
      },
      expected: createOpenAIChatFixtureError(),
    },
  };
});
