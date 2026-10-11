// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import {
  CONVERSATION_GENERATE_TASK_TYPE,
  matchesConversationGenerateTask,
} from "./match-task-type.js";

it("matches only conversation generation", () => {
  expect(matchesConversationGenerateTask(CONVERSATION_GENERATE_TASK_TYPE)).toBe(true);
  expect(matchesConversationGenerateTask("conversation.generate")).toBe(true);
});

it("rejects a different task type", () => {
  expect(matchesConversationGenerateTask("conversation")).toBe(false);
  expect(matchesConversationGenerateTask("Conversation.generate")).toBe(false);
  expect(matchesConversationGenerateTask("conversation.generate.stream")).toBe(false);
  expect(matchesConversationGenerateTask("embedding.generate")).toBe(false);
  expect(matchesConversationGenerateTask("")).toBe(false);
});

it("rejects a non-string task type", () => {
  expect(matchesConversationGenerateTask(undefined as unknown as string)).toBe(false);
});
