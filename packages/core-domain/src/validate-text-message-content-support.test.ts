// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type { MessageContent } from "./message-content.js";
import type { MessageDocument } from "./message-document.js";
import type { MessageEntry } from "./message-entry.js";
import type { MessageGroup } from "./message-group.js";
import { validateTextMessageContentSupport } from "./validate-text-message-content-support.js";

it("accepts an empty document and preserves its identity", () => {
  const document = createDocument([]);
  const result = validateTextMessageContentSupport(document);

  // Empty trees contain no unsupported content and require no fabricated entry.
  expect(result).toEqual({ value: document, diagnostics: [] });
  expect(result.value).toBe(document);
});

it("accepts nested text content in declared order", () => {
  const first = createEntry("entry-first", [createTextContent("content-first", "你好")]);
  const second = createEntry("entry-second", [createTextContent("content-second", "world")]);
  const group = createGroup("group-nested", [first]);
  const document = createDocument([group, second]);

  // Successful traversal observes but does not rebuild nested groups, entries,
  // content collections, or text values.
  expect(validateTextMessageContentSupport(document)).toEqual({
    value: document,
    diagnostics: [],
  });
  expect(document.root.children[0]).toBe(group);
  expect(document.root.children[1]).toBe(second);
  expect(first.content[0]?.kind).toBe("content.text");
});

it("returns the stable unsupported-content diagnostic without a value", () => {
  const unsupported: MessageContent = {
    id: "content-image",
    kind: "provider.content.image",
    metadata: {},
    extensions: {},
  };
  const document = createDocument([createEntry("entry-image", [unsupported])]);
  const result = validateTextMessageContentSupport(document);

  // Failure identifies the exact content position and portable identity facts,
  // while omitting a usable document value entirely.
  expect(Object.hasOwn(result, "value")).toBe(false);
  expect(result.diagnostics).toEqual([
    {
      code: "unsupported_message_content",
      severity: "error",
      phase: "validation",
      message: "Only text message content is supported by this execution path.",
      path: "root.children[0].content[0]",
      details: {
        contentId: "content-image",
        contentKind: "provider.content.image",
      },
    },
  ]);
});

it("reports the first unsupported content in document preorder", () => {
  const nestedEntry = createEntry("entry-nested", [
    createTextContent("content-text", "before"),
    createUnknownContent("content-first-unsupported", "provider.content.audio"),
  ]);
  const laterEntry = createEntry("entry-later", [
    createUnknownContent("content-later-unsupported", "provider.content.video"),
  ]);
  const document = createDocument([createGroup("group-nested", [nestedEntry]), laterEntry]);
  const result = validateTextMessageContentSupport(document);

  // Reverse stack insertion preserves left-to-right preorder, so a later branch
  // cannot replace the deterministic primary diagnostic.
  expect(result.diagnostics[0]).toMatchObject({
    code: "unsupported_message_content",
    path: "root.children[0].children[0].content[1]",
    details: {
      contentId: "content-first-unsupported",
      contentKind: "provider.content.audio",
    },
  });
});

it("does not interpret unsupported metadata as a routing override", () => {
  const unsupported: MessageContent = {
    id: "content-custom",
    kind: "provider.content.custom",
    metadata: {
      treatAsText: true,
      fallback: "content.text",
    },
    extensions: {},
  };
  const document = createDocument([createEntry("entry-custom", [unsupported])]);

  // Only the actual content discriminator defines support; descriptive metadata
  // cannot opt an unknown payload into the text execution path.
  expect(validateTextMessageContentSupport(document).diagnostics[0]?.code).toBe(
    "unsupported_message_content",
  );
});

it("does not mutate a rejected document", () => {
  const text = createTextContent("content-text", "unchanged");
  const unsupported = createUnknownContent("content-unknown", "provider.content.binary");
  const content = [text, unsupported] as const;
  const entry = createEntry("entry-stable", content);
  const children = [entry] as const;
  const document = createDocument(children);

  validateTextMessageContentSupport(document);

  // Rejection leaves collection and object identities, ordering, text, and kind
  // values exactly as supplied for later diagnostics or alternative handling.
  expect(document.root.children).toBe(children);
  expect(entry.content).toBe(content);
  expect(entry.content[0]).toBe(text);
  expect(entry.content[1]).toBe(unsupported);
  expect(text.text).toBe("unchanged");
  expect(unsupported.kind).toBe("provider.content.binary");
});

/** Creates one minimal document whose root owns the supplied ordered children. */
function createDocument(children: readonly (MessageGroup | MessageEntry)[]): MessageDocument {
  // Preserve the caller's collection reference so mutation tests can distinguish
  // observational traversal from a hidden clone or reorder operation.
  return {
    version: "1.0",
    purpose: "input",
    root: {
      id: "root",
      kind: "message.root",
      composition: "container",
      children,
      relations: [],
      metadata: {},
      extensions: {},
    },
    metadata: {},
    extensions: {},
  };
}

/** Creates one message group around the supplied ordered children. */
function createGroup(id: string, children: readonly (MessageGroup | MessageEntry)[]): MessageGroup {
  // Keep all required container fields explicit without introducing Builder or
  // document-validation behavior into these support-range tests.
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

/** Creates one leaf entry around an ordered MessageContent collection. */
function createEntry(id: string, content: readonly MessageContent[]): MessageEntry {
  // Preserve caller content identity while supplying the complete leaf contract.
  return {
    id,
    kind: "message.entry",
    role: { id: "message.user", extensions: {} },
    content,
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Creates one supported plain-text content value. */
function createTextContent(id: string, text: string): MessageContent & { readonly text: string } {
  // Return the concrete text discriminator and payload without normalization.
  return {
    id,
    kind: "content.text",
    text,
    metadata: {},
    extensions: {},
  };
}

/** Creates one integration-defined content value outside text support. */
function createUnknownContent(id: string, kind: string): MessageContent {
  // Preserve caller-selected open identity and avoid adding text-shaped fields.
  return {
    id,
    kind,
    metadata: {},
    extensions: {},
  };
}
