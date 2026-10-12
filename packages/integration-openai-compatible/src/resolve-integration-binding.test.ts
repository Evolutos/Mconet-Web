// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type { RuntimeComponent } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { createIntegrationTypeKey } from "./integration-type-key.js";
import { createIntegrationTypeTable } from "./integration-type-table.js";
import { createModelIntegrationBinding } from "./model-integration-binding.js";
import { resolveIntegrationBinding } from "./resolve-integration-binding.js";

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

it("uses the table before the chain and fails when both miss", () => {
  const tableBinding = binding("binding.table");
  const chainBinding = binding("binding.chain");
  const table = createIntegrationTypeTable([tableBinding]);
  let chainCalls = 0;

  expect(
    resolveIntegrationBinding({
      table,
      chain: [
        () => {
          chainCalls += 1;
          return chainBinding;
        },
      ],
      key,
    }),
  ).toBe(tableBinding);
  expect(chainCalls).toBe(0);

  const missedKey = createIntegrationTypeKey({
    protocolId: "openai.chat.completions",
    taskType: "conversation.generate",
    modeId: "vendor.batch",
  });
  expect(
    resolveIntegrationBinding({
      table,
      chain: [() => chainBinding],
      key: missedKey,
    }),
  ).toBe(chainBinding);

  expect(() =>
    resolveIntegrationBinding({
      table: createIntegrationTypeTable([]),
      chain: [],
      key: missedKey,
    }),
  ).toThrowError(ModelInteractionError);
  try {
    resolveIntegrationBinding({
      table: createIntegrationTypeTable([]),
      chain: [],
      key: missedKey,
    });
  } catch (error) {
    expect(error).toBeInstanceOf(ModelInteractionError);
    expect((error as ModelInteractionError).code).toBe("unsupported_integration");
    expect((error as ModelInteractionError).message).not.toContain("gpt");
  }
});
