// Copyright © 2026 Mcont.

import type { RuntimeComponent } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { createIntegrationTypeKey } from "./integration-type-key.js";
import { matchIntegrationChain } from "./match-integration-chain.js";
import { createModelIntegrationBinding } from "./model-integration-binding.js";

const key = createIntegrationTypeKey({
  protocolId: "openai.chat.completions",
  taskType: "conversation.generate",
  modeId: "unary",
});

const adapter: RuntimeComponent = {
  descriptor: {
    name: "chat-adapter",
    version: "1.0.0",
    capabilities: new Set(),
    source: "plugin",
  },
};

function binding(bindingId: string): ReturnType<typeof createModelIntegrationBinding> {
  return createModelIntegrationBinding({
    key,
    bindingId,
    bindingVersion: "1.0.0",
    taskProtocolAdapter: adapter,
    authorizationHandlers: [],
    payloadEncoders: [],
    payloadDecoders: [],
    transports: [],
  });
}

it("uses the first matching step and does not reorder the chain", () => {
  const first = binding("binding.first");
  const second = binding("binding.second");
  let secondCalls = 0;
  const chain = [
    () => first,
    () => {
      secondCalls += 1;
      return second;
    },
  ];

  expect(matchIntegrationChain(chain, key)).toBe(first);
  expect(secondCalls).toBe(0);
  expect(matchIntegrationChain([...chain].reverse(), key)?.bindingId).toBe("binding.second");
  expect(matchIntegrationChain([() => undefined, () => second], key)).toBe(second);
  expect(matchIntegrationChain([], key)).toBeUndefined();
});
