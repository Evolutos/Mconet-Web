// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import {
  matchesOpenAIChatCompletionsProtocol,
  OPENAI_CHAT_COMPLETIONS_PROTOCOL_ID,
} from "./match-protocol-id.js";

it("matches only the exact chat completions protocol id", () => {
  expect(matchesOpenAIChatCompletionsProtocol(OPENAI_CHAT_COMPLETIONS_PROTOCOL_ID)).toBe(true);
  expect(matchesOpenAIChatCompletionsProtocol("openai.chat.completions")).toBe(true);
});

it("rejects a different spelling, prefix, or model name", () => {
  expect(matchesOpenAIChatCompletionsProtocol("OpenAI.chat.completions")).toBe(false);
  expect(matchesOpenAIChatCompletionsProtocol("openai.chat")).toBe(false);
  expect(matchesOpenAIChatCompletionsProtocol("openai.chat.completions.v2")).toBe(false);
  expect(matchesOpenAIChatCompletionsProtocol("gpt-4o")).toBe(false);
  expect(matchesOpenAIChatCompletionsProtocol("")).toBe(false);
});

it("rejects a non-string protocol id", () => {
  expect(matchesOpenAIChatCompletionsProtocol(undefined as unknown as string)).toBe(false);
});
