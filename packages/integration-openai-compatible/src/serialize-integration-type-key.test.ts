// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type { IntegrationTypeKey } from "./integration-type-key.js";
import { serializeIntegrationTypeKey } from "./serialize-integration-type-key.js";

const key = {
  protocolId: "openai.chat.completions",
  taskType: "conversation.generate",
  modeId: "unary",
};

it("serializes the three fields in a fixed order and omits a model name", () => {
  const modelName = "gpt-secret";
  const withModel = { ...key, model: modelName } as IntegrationTypeKey;
  const serialized = serializeIntegrationTypeKey(withModel);

  expect(serialized).toBe(JSON.stringify([key.protocolId, key.taskType, key.modeId]));
  expect(serializeIntegrationTypeKey(key)).toBe(serialized);
  expect(serialized).not.toContain(modelName);
  expect(
    serializeIntegrationTypeKey({
      protocolId: key.taskType,
      taskType: key.protocolId,
      modeId: key.modeId,
    }),
  ).not.toBe(serialized);
});
