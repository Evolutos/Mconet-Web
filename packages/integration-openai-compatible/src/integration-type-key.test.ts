// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { createIntegrationTypeKey } from "./integration-type-key.js";

it("keeps protocol, task, and mode separate and ignores model identity", () => {
  const key = createIntegrationTypeKey({
    protocolId: "openai.chat.completions",
    taskType: "conversation.generate",
    modeId: "unary",
  });

  expect(key).toEqual({
    protocolId: "openai.chat.completions",
    taskType: "conversation.generate",
    modeId: "unary",
  });
  expect(Object.keys(key)).toEqual(["protocolId", "taskType", "modeId"]);
  expect(Object.isFrozen(key)).toBe(true);
  expect(key).not.toHaveProperty("model");
});

it("rejects a field that is not an open identifier", () => {
  const modelName = "gpt model";
  expect(() =>
    createIntegrationTypeKey({
      protocolId: modelName,
      taskType: "conversation.generate",
      modeId: "unary",
    }),
  ).toThrowError(TypeError);
  try {
    createIntegrationTypeKey({
      protocolId: modelName,
      taskType: "conversation.generate",
      modeId: "unary",
    });
  } catch (error) {
    expect(error).toBeInstanceOf(TypeError);
    expect((error as TypeError).message).not.toContain(modelName);
  }
});
