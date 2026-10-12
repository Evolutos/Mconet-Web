// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { createOpenAIChatCompletionAdapter } from "./openai-chat-completion-adapter.js";
import {
  openAIChatFixtureParsedResponse,
  openAIChatFixtureSuccessMetadata,
  openAIChatFixtureSuccessPayload,
} from "./openai-chat-success.fixture.js";

it("keeps the protocol success fixture stable across two parses", () => {
  const adapter = createOpenAIChatCompletionAdapter();
  const input = {
    payload: openAIChatFixtureSuccessPayload,
    metadata: openAIChatFixtureSuccessMetadata,
  };
  const first = adapter.parseResponse(input);
  const second = adapter.parseResponse(input);

  expect(first.diagnostics).toEqual([]);
  expect(first.value).toEqual(openAIChatFixtureParsedResponse);
  expect(second.value).toEqual(first.value);
});
