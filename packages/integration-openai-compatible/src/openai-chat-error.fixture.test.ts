// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { createOpenAIChatCompletionAdapter } from "./openai-chat-completion-adapter.js";
import {
  createOpenAIChatFixtureError,
  openAIChatFixtureErrorMetadata,
  openAIChatFixtureErrorPayload,
  openAIChatFixtureErrorText,
} from "./openai-chat-error.fixture.js";

it("keeps the protocol error fixture stable and omits the service message", () => {
  const adapter = createOpenAIChatCompletionAdapter();
  const input = {
    payload: openAIChatFixtureErrorPayload,
    metadata: openAIChatFixtureErrorMetadata,
  };
  const first = adapter.parseError(input);
  const second = adapter.parseError(input);
  const expected = createOpenAIChatFixtureError();

  expect(first).toEqual(expected);
  expect(second).toEqual(first);
  expect(first.message).not.toContain(openAIChatFixtureErrorText);
  expect(JSON.stringify(first.diagnostics)).not.toContain(openAIChatFixtureErrorText);
});
