// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { isMessageEntry, ModelInteractionError } from "@evolutos/mconet-core-domain";

import { mapWireChoiceToMessageEntry } from "./map-wire-choice.js";
import { OpenAIChatCompletionChoiceDTO } from "./openai-chat-completion-choice-dto.js";
import { OpenAIChatMessageDTO } from "./openai-chat-message-dto.js";

it("maps assistant choice text exactly and leaves the finish reason off the entry", () => {
  const choice = new OpenAIChatCompletionChoiceDTO(
    0,
    new OpenAIChatMessageDTO("assistant", "你好\n😀"),
    "stop",
    { logprobs: null },
  );

  const entry = mapWireChoiceToMessageEntry(choice);

  expect(isMessageEntry(entry)).toBe(true);
  expect(entry).toEqual({
    id: "choice-0",
    kind: "message.entry",
    role: { id: "message.assistant", rawValue: "assistant", extensions: {} },
    content: [
      {
        id: "choice-0-text",
        kind: "content.text",
        text: "你好\n😀",
        metadata: {},
        extensions: {},
      },
    ],
    relations: [],
    metadata: {},
    extensions: {},
  });
  expect(JSON.stringify(entry)).not.toContain("stop");
  expect(JSON.stringify(entry)).not.toContain("logprobs");
});

it("keeps an empty assistant string as present text", () => {
  const entry = mapWireChoiceToMessageEntry(
    new OpenAIChatCompletionChoiceDTO(1, new OpenAIChatMessageDTO("assistant", ""), "length"),
  );

  expect(entry.id).toBe("choice-1");
  expect(entry.content[0]).toMatchObject({ id: "choice-1-text", text: "" });
});

it("reports an unknown choice role at that choice index", () => {
  const choice = new OpenAIChatCompletionChoiceDTO(
    2,
    new OpenAIChatMessageDTO("tool", "call"),
    "stop",
  );

  expect(() => mapWireChoiceToMessageEntry(choice)).toThrow(ModelInteractionError);
  try {
    mapWireChoiceToMessageEntry(choice);
  } catch (error) {
    expect((error as ModelInteractionError).message).toContain("/choices/2/message/role");
  }
});
