// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { isMessageDocument, ModelInteractionError } from "@evolutos/mconet-core-domain";

import { mapChoicesToMessageDocument } from "./map-choices.js";
import { OpenAIChatCompletionChoiceDTO } from "./openai-chat-completion-choice-dto.js";
import { OpenAIChatMessageDTO } from "./openai-chat-message-dto.js";

function choice(index: number, text: string, finishReason = "stop"): OpenAIChatCompletionChoiceDTO {
  return new OpenAIChatCompletionChoiceDTO(
    index,
    new OpenAIChatMessageDTO("assistant", text),
    finishReason,
  );
}

it("rejects an empty choice list", () => {
  expect(() => mapChoicesToMessageDocument([])).toThrow(ModelInteractionError);
  try {
    mapChoicesToMessageDocument([]);
  } catch (error) {
    expect(error).toBeInstanceOf(ModelInteractionError);
    expect((error as ModelInteractionError).code).toBe("empty_choices");
    expect((error as ModelInteractionError).category).toBe("protocol");
    expect((error as ModelInteractionError).phase).toBe("response_parsing");
  }
});

it("maps one choice to an output document with that text", () => {
  const document = mapChoicesToMessageDocument([choice(0, "你好\n😀", "length")]);

  expect(isMessageDocument(document)).toBe(true);
  expect(document.purpose).toBe("output");
  expect(document.version).toBe("1.0");
  expect(document.root.children).toHaveLength(1);
  expect(document.root.children[0]).toMatchObject({
    id: "choice-0",
    role: { id: "message.assistant" },
    content: [{ text: "你好\n😀" }],
  });
  expect(JSON.stringify(document)).not.toContain("length");
});

it("keeps every choice in service order instead of sorting by index", () => {
  const document = mapChoicesToMessageDocument([choice(1, "sent-first"), choice(0, "sent-second")]);

  expect(document.root.children.map((child) => child.id)).toEqual(["choice-1", "choice-0"]);
  const texts = document.root.children.map((child) =>
    child.kind === "message.entry" ? child.content[0]?.text : undefined,
  );
  expect(texts).toEqual(["sent-first", "sent-second"]);
});

it("rejects a choice that was not parsed as a choice", () => {
  const lookalike = {
    index: 0,
    message: {},
    finishReason: "stop",
  } as unknown as OpenAIChatCompletionChoiceDTO;

  expect(() => mapChoicesToMessageDocument([lookalike])).toThrow(TypeError);
});

it("rejects a duplicated choice index without copying message text", () => {
  const secret = "choice-secret";

  let caught: unknown;
  try {
    mapChoicesToMessageDocument([choice(0, secret), choice(0, "other")]);
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(ModelInteractionError);
  const error = caught as ModelInteractionError;
  expect(error.code).toBe("duplicate_choice_index");
  expect(error.message).toContain("0");
  expect(error.message).not.toContain(secret);
});
