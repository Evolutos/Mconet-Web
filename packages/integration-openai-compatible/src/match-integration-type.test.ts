// Copyright © 2026 Mcont.

import type { RuntimeComponent } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { createIntegrationTypeKey } from "./integration-type-key.js";
import { createIntegrationTypeTable } from "./integration-type-table.js";
import { matchIntegrationType } from "./match-integration-type.js";
import { createModelIntegrationBinding } from "./model-integration-binding.js";

const adapter: RuntimeComponent = {
  descriptor: {
    name: "chat-adapter",
    version: "1.0.0",
    capabilities: new Set(),
    source: "plugin",
  },
};

function binding(
  protocolId: string,
  modeId: string,
): ReturnType<typeof createModelIntegrationBinding> {
  return createModelIntegrationBinding({
    key: createIntegrationTypeKey({
      protocolId,
      taskType: "conversation.generate",
      modeId,
    }),
    bindingId: `${protocolId}:${modeId}`,
    bindingVersion: "1.0.0",
    taskProtocolAdapter: adapter,
    authorizationHandlers: [],
    payloadEncoders: [],
    payloadDecoders: [],
    transports: [],
  });
}

it("returns only the binding with the same protocol, task, and mode", () => {
  const exact = binding("openai.chat.completions", "unary");
  const table = createIntegrationTypeTable([
    exact,
    binding("openai.chat.completions", "vendor.batch"),
  ]);
  const found = matchIntegrationType(table, exact.key);

  expect(found).toBe(exact);
  expect(
    matchIntegrationType(
      table,
      createIntegrationTypeKey({
        protocolId: "openai.chat",
        taskType: "conversation.generate",
        modeId: "unary",
      }),
    ),
  ).toBeUndefined();
  expect(
    matchIntegrationType(
      table,
      createIntegrationTypeKey({
        protocolId: "openai.chat.completions",
        taskType: "conversation.generate",
        modeId: "vendor.batch",
      }),
    ),
  ).not.toBe(exact);
});
