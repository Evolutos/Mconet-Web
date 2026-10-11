// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import {
  isMessageEntry,
  ModelInteractionError,
  type MessageContent,
  type MessageEntry,
  type MessageRole,
} from "@evolutos/mconet-core-domain";

import { mapMessageEntryToWire, mapWireMessageToDomain } from "./map-message-entry.js";
import { OpenAIChatMessageDTO } from "./openai-chat-message-dto.js";

function textContent(id: string, text: string): MessageContent {
  return { id, kind: "content.text", text, metadata: {}, extensions: {} };
}

function role(id: string, extra: Partial<MessageRole> = {}): MessageRole {
  return { id, extensions: {}, ...extra };
}

function entry(
  roleId: string,
  texts: readonly string[],
  extra: Partial<MessageEntry> = {},
): MessageEntry {
  return {
    id: "entry-1",
    kind: "message.entry",
    role: role(roleId),
    content: texts.map((text, index) => textContent(`content-${index + 1}`, text)),
    relations: [],
    metadata: {},
    extensions: {},
    ...extra,
  };
}

it("maps role and joins content in declared order without a separator", () => {
  const message = mapMessageEntryToWire(entry("message.user", ["b", "", "a\n", "e\u0301 😀"]));

  expect(message.role).toBe("user");
  expect(message.content).toBe("ba\ne\u0301 😀");
  expect(message.toJson()).toEqual({ role: "user", content: "ba\ne\u0301 😀" });
});

it("maps each standard role independently of content order", () => {
  expect(mapMessageEntryToWire(entry("message.system", ["second", "first"])).toJson()).toEqual({
    role: "system",
    content: "secondfirst",
  });
  expect(mapMessageEntryToWire(entry("message.assistant", ["only"])).role).toBe("assistant");
});

it("does not write relations, metadata, or extensions onto the wire message", () => {
  const secret = "relation-secret";
  const message = mapMessageEntryToWire(
    entry("message.user", ["visible"], {
      relations: [{ sourceId: "entry-1", targetId: "other", type: "follows", metadata: {} }],
      metadata: { note: secret },
      extensions: { "vendor.trace": secret },
    }),
  );

  expect(message.toJson()).toEqual({ role: "user", content: "visible" });
  expect(JSON.stringify(message.toJson())).not.toContain(secret);
  expect(message.extensions).toEqual({});
});

it("rejects an entry that is not a message leaf", () => {
  const secret = "shape-secret";
  const lookalike = {
    id: "entry-1",
    kind: "message.entry",
    role: role("message.user"),
    content: [],
    relations: [],
    metadata: { note: secret },
    extensions: {},
    children: [],
  } as unknown as MessageEntry;

  let caught: unknown;
  try {
    mapMessageEntryToWire(lookalike);
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(ModelInteractionError);
  const error = caught as ModelInteractionError;
  expect(error.code).toBe("invalid_message_entry");
  expect(error.category).toBe("invalid_request");
  expect(error.phase).toBe("protocol_adaptation");
  expect(error.message).not.toContain(secret);
});

it("rejects an unsupported role without using semantic or rawValue", () => {
  const custom = entry("message.tool", ["call"], {
    role: role("message.tool", { semantic: "assistant", rawValue: "assistant" }),
  });

  expect(() => mapMessageEntryToWire(custom)).toThrow(ModelInteractionError);
  try {
    mapMessageEntryToWire(custom);
  } catch (error) {
    expect(error).toBeInstanceOf(ModelInteractionError);
    expect((error as ModelInteractionError).code).toBe("unsupported_message_role");
  }
});

it("rejects non-text content before producing a message", () => {
  const secret = "payload-secret";
  const mixed = entry("message.user", ["keep"], {
    content: [
      textContent("content-1", "keep"),
      { id: "content-json", kind: "content.json", metadata: { note: secret }, extensions: {} },
    ],
  });

  let caught: unknown;
  try {
    mapMessageEntryToWire(mixed);
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(ModelInteractionError);
  const error = caught as ModelInteractionError;
  expect(error.code).toBe("unsupported_message_content");
  expect(error.message).not.toContain(secret);
  expect(error.message).not.toContain("keep");
});

it("creates one frozen entry whose single content keeps the response text", () => {
  const message = new OpenAIChatMessageDTO("assistant", "hi 😀\n", { ignored: true });
  const mapped = mapWireMessageToDomain(
    message,
    "choice-0",
    "choice-0-text",
    "/choices/0/message/role",
  );

  expect(isMessageEntry(mapped)).toBe(true);
  expect(mapped).toEqual({
    id: "choice-0",
    kind: "message.entry",
    role: { id: "message.assistant", rawValue: "assistant", extensions: {} },
    content: [
      {
        id: "choice-0-text",
        kind: "content.text",
        text: "hi 😀\n",
        metadata: {},
        extensions: {},
      },
    ],
    relations: [],
    metadata: {},
    extensions: {},
  });
  expect(mapped.content).toHaveLength(1);
  expect(Object.isFrozen(mapped)).toBe(true);
  expect(Object.isFrozen(mapped.content)).toBe(true);
  expect(Object.isFrozen(mapped.relations)).toBe(true);
  expect(mapped.extensions).not.toHaveProperty("ignored");
});

it("keeps an empty response string as one present text content", () => {
  const mapped = mapWireMessageToDomain(
    new OpenAIChatMessageDTO("system", ""),
    "choice-0",
    "choice-0-text",
    "/choices/0/message/role",
  );

  expect(mapped.role.id).toBe("message.system");
  expect(mapped.content[0]).toMatchObject({ kind: "content.text", text: "" });
});

it("reports an unknown response role at the supplied path", () => {
  const message = new OpenAIChatMessageDTO("tool", "call");

  expect(() =>
    mapWireMessageToDomain(message, "choice-0", "choice-0-text", "/choices/0/message/role"),
  ).toThrow(ModelInteractionError);
  try {
    mapWireMessageToDomain(message, "choice-0", "choice-0-text", "/choices/0/message/role");
  } catch (error) {
    expect((error as ModelInteractionError).code).toBe("invalid_protocol_response");
    expect((error as ModelInteractionError).message).toContain("/choices/0/message/role");
  }
});

it("rejects a response identity that is not an open identifier", () => {
  const message = new OpenAIChatMessageDTO("user", "hi");

  expect(() => mapWireMessageToDomain(message, "", "choice-0-text", "/role")).toThrow(TypeError);
  expect(() => mapWireMessageToDomain(message, "choice-0", "bad id", "/role")).toThrow(TypeError);
});
