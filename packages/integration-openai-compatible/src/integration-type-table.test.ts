// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type { RuntimeComponent } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { createIntegrationTypeKey } from "./integration-type-key.js";
import { createIntegrationTypeTable } from "./integration-type-table.js";
import { createModelIntegrationBinding } from "./model-integration-binding.js";

const adapter: RuntimeComponent = {
  descriptor: {
    name: "chat-adapter",
    version: "1.0.0",
    capabilities: new Set(),
    source: "plugin",
  },
};

function binding(modeId: string): ReturnType<typeof createModelIntegrationBinding> {
  return createModelIntegrationBinding({
    key: createIntegrationTypeKey({
      protocolId: "openai.chat.completions",
      taskType: "conversation.generate",
      modeId,
    }),
    bindingId: `binding.${modeId}`,
    bindingVersion: "1.0.0",
    taskProtocolAdapter: adapter,
    authorizationHandlers: [],
    payloadEncoders: [],
    payloadDecoders: [],
    transports: [],
  });
}

it("keeps distinct keys and rejects a duplicate without exposing mutation", () => {
  const unary = binding("unary");
  const other = binding("vendor.batch");
  const source = [unary, other];
  const table = createIntegrationTypeTable(source);
  source.pop();

  expect(table.size).toBe(2);
  expect(Object.isFrozen(table)).toBe(true);
  expect(table).not.toHaveProperty("set");
  expect(table).not.toHaveProperty("delete");

  expect(() => createIntegrationTypeTable([unary, binding("unary")])).toThrowError(
    ModelInteractionError,
  );
  try {
    createIntegrationTypeTable([unary, binding("unary")]);
  } catch (error) {
    expect(error).toBeInstanceOf(ModelInteractionError);
    expect((error as ModelInteractionError).code).toBe("duplicate_integration_type");
  }
});
