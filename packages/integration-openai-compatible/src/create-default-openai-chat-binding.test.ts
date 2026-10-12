// Copyright © 2026 Mcont.

import type { ModelTarget, TaskDescriptor } from "@evolutos/mconet-core-domain";
import type { RuntimeComponent } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { createDefaultOpenAIChatBinding } from "./create-default-openai-chat-binding.js";
import { createOpenAIChatCompletionAdapter } from "./openai-chat-completion-adapter.js";

const role: RuntimeComponent = {
  descriptor: {
    name: "role",
    version: "1.0.0",
    capabilities: new Set(),
    source: "application",
  },
};

function target(modelName: string, protocolId = "openai.chat.completions"): ModelTarget {
  return {
    serviceId: "example",
    protocolId,
    model: { name: modelName, metadata: {}, extensions: {} },
    extensions: {},
  };
}

const task: TaskDescriptor = {
  type: "conversation.generate",
  metadata: {},
  extensions: {},
};

it("fills every role and selects the adapter without using the model name", () => {
  const binding = createDefaultOpenAIChatBinding({
    authorizationHandlers: [role],
    payloadEncoders: [role],
    payloadDecoders: [role],
    transports: [role],
  });
  const adapter = createOpenAIChatCompletionAdapter();

  expect(binding.key).toEqual({
    protocolId: "openai.chat.completions",
    taskType: "conversation.generate",
    modeId: "unary",
  });
  expect(binding.bindingId).toBe("binding.openai.chat.completions");
  expect(binding.authorizationHandlers).toEqual([role]);
  expect(binding.payloadEncoders).toEqual([role]);
  expect(binding.payloadDecoders).toEqual([role]);
  expect(binding.transports).toEqual([role]);
  expect(adapter.supports({ target: target("model-a"), task, mode: { id: "unary" } })).toBe(true);
  expect(adapter.supports({ target: target("model-b"), task, mode: { id: "unary" } })).toBe(true);
  expect(
    adapter.supports({ target: target("model-a", "other.protocol"), task, mode: { id: "unary" } }),
  ).toBe(false);
  expect(() =>
    createDefaultOpenAIChatBinding({
      authorizationHandlers: [role],
      payloadEncoders: [role],
      payloadDecoders: [role],
      transports: [],
    }),
  ).toThrowError(TypeError);
});
