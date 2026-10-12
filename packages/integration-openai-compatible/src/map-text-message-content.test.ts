// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import {
  isTextMessageContent,
  ModelInteractionError,
  type MessageContent,
  type UnknownMessageContent,
} from "@evolutos/mconet-core-domain";

import { mapTextMessageContentToWire, mapWireTextToDomain } from "./map-text-message-content.js";

function textContent(text: string): MessageContent {
  return { id: "c1", kind: "content.text", text, metadata: {}, extensions: {} };
}

it("returns text exactly, including empty, Unicode, and line breaks", () => {
  const fixtures = ["", "hello", "  padded \t", "line1\r\nline2\n", "e\u0301 😀 中文", "\u0000"];

  for (const text of fixtures) {
    expect(mapTextMessageContentToWire(textContent(text))).toBe(text);
  }
});

it("does not normalize Unicode", () => {
  const decomposed = "e\u0301";
  const composed = "\u00e9";

  expect(mapTextMessageContentToWire(textContent(decomposed))).toBe(decomposed);
  expect(mapTextMessageContentToWire(textContent(decomposed))).not.toBe(composed);
});

it("rejects non-text content with a stable code and no payload", () => {
  const secret = "TEST_ONLY_DO_NOT_USE";
  const content: UnknownMessageContent = {
    id: "c2",
    kind: "content.json",
    metadata: { note: secret },
    extensions: {},
  };

  let caught: unknown;
  try {
    mapTextMessageContentToWire(content);
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(ModelInteractionError);
  const error = caught as ModelInteractionError;
  expect(error.code).toBe("unsupported_message_content");
  expect(error.category).toBe("unsupported_feature");
  expect(error.phase).toBe("protocol_adaptation");
  expect(error.message).toContain("content.json");
  expect(error.message).not.toContain(secret);
});

it("does not read content that only claims the text kind", () => {
  const lookalike = {
    id: "c3",
    kind: "content.text",
    metadata: {},
    extensions: {},
  } as unknown as MessageContent;

  expect(() => mapTextMessageContentToWire(lookalike)).toThrow(ModelInteractionError);
});

it("creates frozen standard text content from a response string", () => {
  const content = mapWireTextToDomain("hi 😀", "choice-0-text");

  expect(content).toEqual({
    id: "choice-0-text",
    kind: "content.text",
    text: "hi 😀",
    metadata: {},
    extensions: {},
  });
  expect(isTextMessageContent(content)).toBe(true);
  expect(Object.isFrozen(content)).toBe(true);
  expect(Object.isFrozen(content.metadata)).toBe(true);
  expect(Object.isFrozen(content.extensions)).toBe(true);
});

it("keeps an empty response string as present empty text", () => {
  const content = mapWireTextToDomain("", "choice-0-text");

  expect(content.text).toBe("");
  expect(isTextMessageContent(content)).toBe(true);
});
