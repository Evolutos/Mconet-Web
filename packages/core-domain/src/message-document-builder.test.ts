// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import { MessageDocumentBuilder } from "./message-document-builder.js";
import type { MessageDocument } from "./message-document.js";
import type { MessageEntry } from "./message-entry.js";
import type { MessageGroup } from "./message-group.js";

/**
 * Creates one complete text entry for document-tree fixtures.
 *
 * @param id Stable entry identity.
 * @param contentId Stable content identity in the shared document namespace.
 * @param relations Optional ordered local relation descriptions.
 * @returns Complete entry with one text content value.
 */
function createEntry(
  id: string,
  contentId: string,
  relations: MessageEntry["relations"] = [],
): MessageEntry {
  // Every local field is explicit so document Builder tests isolate envelope and
  // whole-tree behavior instead of relying on another construction helper.
  return {
    id,
    kind: "message.entry",
    role: { id: "message.user", extensions: {} },
    content: [
      {
        id: contentId,
        kind: "content.text",
        text: id,
        metadata: {},
        extensions: {},
      },
    ],
    relations,
    metadata: {},
    extensions: {},
  };
}

/**
 * Creates an exact message.root container with caller-selected children.
 *
 * @param children Ordered nested groups and entries retained by identity.
 * @returns Complete root group with empty relations and JSON maps.
 */
function createRoot(children: MessageGroup["children"] = []): MessageGroup {
  // Retain the supplied child collection by identity so tests can detect any
  // unexpected Builder copy, reorder, or tree mutation.
  return {
    id: "root",
    kind: "message.root",
    composition: "container",
    children,
    relations: [],
    metadata: {},
    extensions: {},
  };
}

describe("MessageDocumentBuilder", () => {
  it("builds the same neutral envelope as direct MessageDocument construction", () => {
    const first = createEntry("entry-1", "content-1");
    const second = createEntry("entry-2", "content-2");
    const children = [first, second];
    const root = createRoot(children);
    const metadata = { locale: "zh-CN", sequence: 0 } as const;
    const extensions = { "provider.trace": { enabled: false } } as const;

    const built = new MessageDocumentBuilder("1.0", "provider.review_context", root)
      .withMetadata(metadata)
      .withExtensions(extensions)
      .build();
    const direct: MessageDocument = {
      version: "1.0",
      purpose: "provider.review_context",
      root,
      metadata,
      extensions,
    };

    // Structural equality and exact keys prove construction adds no Task, access,
    // model, protocol, authorization, or runtime execution fields.
    expect(built).toEqual(direct);
    expect(Object.keys(built)).toEqual(["version", "purpose", "root", "metadata", "extensions"]);
    expect(built.root).toBe(root);
    expect(built.root.children).toBe(children);
    expect(built.metadata).toBe(metadata);
    expect(built.extensions).toBe(extensions);
  });

  it("supplies only required empty JSON maps by default", () => {
    const document = new MessageDocumentBuilder("future-version", "input", createRoot()).build();

    // Empty maps satisfy the always-present contract without guessing version,
    // root content, purpose semantics, or surrounding task configuration.
    expect(document.version).toBe("future-version");
    expect(document.purpose).toBe("input");
    expect(document.metadata).toEqual({});
    expect(document.extensions).toEqual({});
  });

  it("returns independent frozen envelopes for later metadata changes", () => {
    const root = createRoot();
    const builder = new MessageDocumentBuilder("1.0", "context", root);
    const first = builder.build();
    const metadata = { revision: 2 };
    const extensions = { "provider.review": true };
    const second = builder.withMetadata(metadata).withExtensions(extensions).build();

    // Reconfiguring the Builder selects references only for future envelopes and
    // never rewrites fields on the previously returned frozen object.
    expect(first).not.toBe(second);
    expect(first.metadata).toEqual({});
    expect(first.extensions).toEqual({});
    expect(second.metadata).toBe(metadata);
    expect(second.extensions).toBe(extensions);
    expect(first.root).toBe(root);
    expect(second.root).toBe(root);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(second)).toBe(true);
  });

  it("delegates envelope and whole-tree rejection to isMessageDocument", () => {
    const validRoot = createRoot([createEntry("entry-1", "content-1")]);
    const ordinaryRoot = { ...createRoot(), kind: "message.group" } as MessageGroup;
    const duplicateRoot = createRoot([
      createEntry("duplicate", "content-1"),
      createEntry("duplicate", "content-2"),
    ]);
    const unresolvedEntry = createEntry("entry-1", "content-1", [
      {
        sourceId: "entry-1",
        targetId: "missing",
        type: "message.reply",
        metadata: {},
      },
    ]);
    const unresolvedRoot = createRoot([unresolvedEntry]);

    // String syntax requires runtime validation; structurally malformed typed
    // values require assertions, and cross-node semantics are validated exactly once.
    expect(() => new MessageDocumentBuilder(" ", "input", validRoot).build()).toThrow(TypeError);
    expect(() => new MessageDocumentBuilder("1.0", "invalid purpose", validRoot).build()).toThrow(
      TypeError,
    );
    expect(() => new MessageDocumentBuilder("1.0", "input", ordinaryRoot).build()).toThrow(
      TypeError,
    );
    expect(() => new MessageDocumentBuilder("1.0", "input", duplicateRoot).build()).toThrow(
      TypeError,
    );
    expect(() => new MessageDocumentBuilder("1.0", "input", unresolvedRoot).build()).toThrow(
      TypeError,
    );
    expect(() =>
      new MessageDocumentBuilder("1.0", "input", validRoot)
        .withMetadata({ invalid: Number.NaN })
        .build(),
    ).toThrow(TypeError);
    expect(() =>
      new MessageDocumentBuilder("1.0", "input", validRoot)
        .withExtensions([] as unknown as Extensions)
        .build(),
    ).toThrow(TypeError);
  });

  it("does not mutate or freeze caller-owned root and JSON maps", () => {
    const entry = createEntry("entry-1", "content-1");
    const children = [entry];
    const root = createRoot(children);
    const metadata = { source: "caller" };
    const extensions = { "provider.flag": true };

    new MessageDocumentBuilder("1.0", "output", root)
      .withMetadata(metadata)
      .withExtensions(extensions)
      .build();

    // The outer envelope is Builder-owned, but taking hidden ownership of a root
    // tree or JSON map would diverge from direct MessageDocument construction.
    expect(Object.isFrozen(root)).toBe(false);
    expect(Object.isFrozen(children)).toBe(false);
    expect(Object.isFrozen(entry)).toBe(false);
    expect(Object.isFrozen(metadata)).toBe(false);
    expect(Object.isFrozen(extensions)).toBe(false);
  });

  it("exposes only the reviewed envelope setter and build signatures", () => {
    const root = createRoot();

    // Exact signatures keep this Builder on existing domain contracts and avoid
    // introducing an options model or accepting unrelated request configuration.
    expectTypeOf(MessageDocumentBuilder).toBeConstructibleWith("1.0", "input", root);
    expectTypeOf<MessageDocumentBuilder["withMetadata"]>().toEqualTypeOf<
      (metadata: Readonly<Record<string, JsonValue>>) => MessageDocumentBuilder
    >();
    expectTypeOf<MessageDocumentBuilder["withExtensions"]>().toEqualTypeOf<
      (extensions: Extensions) => MessageDocumentBuilder
    >();
    expectTypeOf<MessageDocumentBuilder["build"]>().toEqualTypeOf<() => MessageDocument>();
  });
});
