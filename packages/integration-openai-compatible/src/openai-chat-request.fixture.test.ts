// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { createOpenAIChatCompletionAdapter } from "./openai-chat-completion-adapter.js";
import {
  createOpenAIChatFixtureRequest,
  openAIChatFixtureMode,
  openAIChatFixturePlan,
  openAIChatFixturePolicy,
  openAIChatFixtureRequestBody,
} from "./openai-chat-request.fixture.js";

it("keeps the protocol request fixture stable across two plans and two bodies", () => {
  const adapter = createOpenAIChatCompletionAdapter();
  const input = {
    request: createOpenAIChatFixtureRequest(),
    mode: openAIChatFixtureMode,
    policy: openAIChatFixturePolicy,
  };
  const firstPlan = adapter.preparePlan(input);
  const secondPlan = adapter.preparePlan({
    request: createOpenAIChatFixtureRequest(),
    mode: openAIChatFixtureMode,
    policy: openAIChatFixturePolicy,
  });

  expect(firstPlan.diagnostics).toEqual([]);
  expect(firstPlan.value).toEqual(openAIChatFixturePlan);
  expect(secondPlan.value).toEqual(firstPlan.value);

  const built = adapter.buildRequest({
    request: createOpenAIChatFixtureRequest(),
    plan: firstPlan.value ?? openAIChatFixturePlan,
  });
  expect(built.diagnostics).toEqual([]);
  expect(built.value?.payload).toEqual({
    typeId: "protocol.openai.chat-request",
    value: openAIChatFixtureRequestBody,
  });
  expect(
    adapter.buildRequest({
      request: createOpenAIChatFixtureRequest(),
      plan: firstPlan.value ?? openAIChatFixturePlan,
    }).value?.payload,
  ).toEqual(built.value?.payload);
});
