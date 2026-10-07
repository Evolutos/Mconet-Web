// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ConversationTaskResult } from "./conversation-task-result.js";
import type { MessageContent } from "./message-content.js";
import type { MessageDocument } from "./message-document.js";
import type { MessageEntry } from "./message-entry.js";
import type { MessageGroup } from "./message-group.js";
import { projectConversationText } from "./project-conversation-text.js";

it("projects assistant text in tree preorder and content order", () => {
  const opaque = createOpaqueContent("first-opaque");
  const firstAssistant = createEntry("assistant-first", "message.assistant", [
    createText("first-a", "你好，"),
    opaque,
    createText("first-b", "世界 🌍"),
  ]);
  const ignoredUser = createEntry("user", "message.user", [
    createText("user-text", "不得进入结果文本"),
  ]);
  const secondAssistant = createEntry("assistant-second", "message.assistant", [
    createText("second-a", "\n第二行 e\u0301"),
    createText("second-empty", ""),
  ]);
  const nested = createGroup("nested", [secondAssistant]);
  const root = createRoot([firstAssistant, ignoredUser, nested]);
  const result = createResult(root);

  // Preorder visits the first entry before the nested entry; content order then
  // preserves producer whitespace, decomposed Unicode, and the empty segment.
  expect(projectConversationText(result)).toBe("你好，世界 🌍\n第二行 e\u0301");
  expect(firstAssistant.content[1]).toBe(opaque);
  expect(result.messages.root).toBe(root);
});

it("requires the exact standard assistant role identity", () => {
  const semanticOnly = {
    ...createEntry("semantic", "vendor.responder", [
      createText("semantic-text", "ignored semantic hint"),
    ]),
    role: {
      id: "vendor.responder",
      semantic: "assistant",
      rawValue: "assistant",
      extensions: {},
    },
  } as const satisfies MessageEntry;
  const user = createEntry("user", "message.user", [createText("user-text", "ignored user")]);
  const assistant = createEntry("assistant", "message.assistant", [
    createText("assistant-text", "kept"),
  ]);

  // Semantic and raw preservation fields never override the open role identity.
  expect(projectConversationText(createResult(createRoot([semanticOnly, user, assistant])))).toBe(
    "kept",
  );
});

it("returns an empty string when no assistant text exists", () => {
  const empty = createResult(createRoot([]));
  const nonTextAssistant = createResult(
    createRoot([createEntry("assistant", "message.assistant", [createOpaqueContent("opaque")])]),
  );

  // A total string view avoids manufacturing an entry, a separator, or text for
  // unsupported assistant content.
  expect(projectConversationText(empty)).toBe("");
  expect(projectConversationText(nonTextAssistant)).toBe("");
});

it("does not mutate the result or any ordered source collection", () => {
  const text = createText("text", "unchanged");
  const content = Object.freeze([text]);
  const entry = Object.freeze(createEntry("assistant", "message.assistant", content));
  const children = Object.freeze([entry]);
  const root = Object.freeze(createRoot(children));
  const result = Object.freeze(createResult(root));

  // Frozen inputs turn accidental writes or in-place reversal into a failure;
  // exact identities and order remain observable after the projection.
  expect(projectConversationText(result)).toBe("unchanged");
  expect(result.messages.root).toBe(root);
  expect(root.children).toBe(children);
  expect(entry.content).toBe(content);
  expect(root.children).toEqual([entry]);
  expect(entry.content).toEqual([text]);
});

it("uses iterative traversal for deeply nested valid trees", () => {
  const leaf = createEntry("assistant", "message.assistant", [createText("text", "deep")]);
  let nested: MessageGroup | MessageEntry = leaf;

  // Build a depth that would make a recursive convenience traversal fragile;
  // every group retains exactly one ordered child and distinct identity.
  for (let depth = 0; depth < 20_000; depth += 1) {
    nested = createGroup(`group-${String(depth)}`, [nested]);
  }

  // The public function completes without depending on the JavaScript call stack.
  expect(projectConversationText(createResult(createRoot([nested])))).toBe("deep");
});

it("exposes one readonly projection function with an exact signature", () => {
  // The helper returns a primitive view and exposes no builder, mutable cache, or
  // protocol-specific projection options.
  expectTypeOf(projectConversationText).toEqualTypeOf<(result: ConversationTaskResult) => string>();
});

/** Creates one standard text content value with exact caller-owned text. */
function createText(id: string, text: string): MessageContent {
  // Metadata and extensions remain explicit domain fields and do not contribute
  // characters to the projection.
  return { id, kind: "content.text", text, metadata: {}, extensions: {} };
}

/** Creates one supported unknown content value that must not become text. */
function createOpaqueContent(id: string): MessageContent {
  // The raw payload proves projection does not decode or stringify unknown bytes.
  return {
    id,
    kind: "vendor.opaque",
    raw: { bytes: new Uint8Array([0x74, 0x65, 0x78, 0x74]), truncated: false, metadata: {} },
    metadata: {},
    extensions: {},
  };
}

/** Creates one message entry while retaining the supplied content collection. */
function createEntry(id: string, roleId: string, content: readonly MessageContent[]): MessageEntry {
  // Role identity and ordered content are fixed during fixture construction;
  // projection never replaces either caller-owned value.
  return {
    id,
    kind: "message.entry",
    role: { id: roleId, extensions: {} },
    content,
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Creates one non-root message group with caller-declared child order. */
function createGroup(id: string, children: readonly (MessageGroup | MessageEntry)[]): MessageGroup {
  // Container metadata is unrelated to the text view and remains untouched.
  return {
    id,
    kind: "message.group",
    composition: "container",
    children,
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Creates the required root container with caller-declared child order. */
function createRoot(children: readonly (MessageGroup | MessageEntry)[]): MessageGroup {
  // Root identity and purpose remain structural; only descendant entries can
  // contribute text.
  return {
    ...createGroup("root", children),
    kind: "message.root",
  };
}

/** Creates one complete conversation result around an authoritative Message tree. */
function createResult(root: MessageGroup): ConversationTaskResult {
  const messages: MessageDocument = {
    version: "1.0",
    purpose: "output",
    root,
    metadata: {},
    extensions: {},
  };

  // Common result fields are complete but remain outside projection semantics.
  return {
    descriptor: { type: "conversation.generate", metadata: {}, extensions: {} },
    document: {
      version: "1.0",
      root: {
        id: "task-root",
        kind: "task.root",
        composition: "container",
        children: [],
        relations: [],
        metadata: {},
        extensions: {},
      },
      metadata: {},
      extensions: {},
    },
    messages,
    artifacts: { artifacts: [] },
    metadata: {},
    extensions: {},
  };
}
