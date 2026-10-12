// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import {
  ModelInteractionError,
  type MessageDocument,
  type MessageEntry,
  type MessageGroup,
} from "@evolutos/mconet-core-domain";

import { mapMessageDocumentToWire } from "./map-message-document.js";

function entry(id: string, roleId: string, texts: readonly string[]): MessageEntry {
  return {
    id,
    kind: "message.entry",
    role: { id: roleId, extensions: {} },
    content: texts.map((text, index) => ({
      id: `${id}-content-${index + 1}`,
      kind: "content.text" as const,
      text,
      metadata: {},
      extensions: {},
    })),
    relations: [],
    metadata: {},
    extensions: {},
  };
}

function group(id: string, children: MessageGroup["children"]): MessageGroup {
  return {
    id,
    kind: id === "root" ? "message.root" : "message.group",
    composition: "container",
    children,
    relations: [],
    metadata: {},
    extensions: {},
  };
}

function document(root: MessageGroup, extra: Partial<MessageDocument> = {}): MessageDocument {
  return {
    version: "1.0",
    purpose: "input",
    root,
    metadata: {},
    extensions: {},
    ...extra,
  };
}

it("emits one message per entry in nested preorder", () => {
  const first = entry("turn-z", "message.user", ["first-", "a"]);
  const nested = entry("turn-a", "message.assistant", ["nested"]);
  const third = entry("turn-m", "message.user", ["third"]);
  const last = entry("turn-b", "message.system", ["last"]);
  const tree = document(group("root", [first, group("group-1", [nested, third]), last]));

  const messages = mapMessageDocumentToWire(tree);

  expect(messages.map((message) => message.toJson())).toEqual([
    { role: "user", content: "first-a" },
    { role: "assistant", content: "nested" },
    { role: "user", content: "third" },
    { role: "system", content: "last" },
  ]);
  expect(Object.isFrozen(messages)).toBe(true);
  expect(tree.root.children.map((child) => child.id)).toEqual(["turn-z", "group-1", "turn-b"]);
});

it("returns an empty list when the tree has no entries", () => {
  const messages = mapMessageDocumentToWire(document(group("root", [group("group-1", [])])));

  expect(messages).toEqual([]);
  expect(Object.isFrozen(messages)).toBe(true);
});

it("does not copy document metadata or extensions into messages", () => {
  const secret = "TEST_ONLY_DO_NOT_USE";
  const messages = mapMessageDocumentToWire(
    document(group("root", [entry("turn-1", "message.user", ["visible"])]), {
      metadata: { note: secret },
      extensions: { "vendor.trace": secret },
    }),
  );

  expect(messages).toHaveLength(1);
  expect(JSON.stringify(messages[0]?.toJson())).not.toContain(secret);
});

it("rejects a value that is not a message document", () => {
  const secret = "TEST_ONLY_DO_NOT_USE";
  const lookalike = {
    version: "1.0",
    purpose: "input",
    metadata: { note: secret },
    extensions: {},
  } as unknown as MessageDocument;

  let caught: unknown;
  try {
    mapMessageDocumentToWire(lookalike);
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(ModelInteractionError);
  const error = caught as ModelInteractionError;
  expect(error.code).toBe("invalid_message_document");
  expect(error.category).toBe("invalid_request");
  expect(error.phase).toBe("protocol_adaptation");
  expect(error.message).not.toContain(secret);
});

it("rejects non-text content without returning earlier turns", () => {
  const secret = "TEST_ONLY_DO_NOT_USE";
  const tree = document(
    group("root", [
      entry("turn-1", "message.user", ["keep"]),
      {
        ...entry("turn-2", "message.user", ["drop"]),
        content: [
          {
            id: "turn-2-json",
            kind: "content.json",
            metadata: { note: secret },
            extensions: {},
          },
        ],
      },
    ]),
  );

  let caught: unknown;
  try {
    mapMessageDocumentToWire(tree);
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(ModelInteractionError);
  const error = caught as ModelInteractionError;
  expect(error.code).toBe("unsupported_message_content");
  expect(error.message).not.toContain(secret);
  expect(error.message).not.toContain("keep");
});
