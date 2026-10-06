// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { MessageContent } from "./message-content.js";
import { MessageEntryBuilder } from "./message-entry-builder.js";
import type { MessageEntry } from "./message-entry.js";
import type { MessageRelation } from "./message-relation.js";
import type { MessageRole } from "./message-role.js";

/** Creates one valid text content value with a caller-selected identity. */
function createTextContent(id: string, text: string): MessageContent {
  // Every required field is explicit so Builder tests do not depend on a future
  // content factory or defaulting behavior.
  return {
    id,
    kind: "content.text",
    text,
    metadata: {},
    extensions: {},
  };
}

/** Creates one locally valid relation without requiring a complete document. */
function createRelation(targetId: string): MessageRelation {
  // The source uses the fixture entry ID while target resolution intentionally
  // remains outside the local MessageEntryBuilder contract.
  return {
    sourceId: "entry-1",
    targetId,
    type: "message.precedes",
    metadata: {},
  };
}

describe("MessageEntryBuilder", () => {
  it("builds the same complete shape as direct MessageEntry construction", () => {
    const role: MessageRole = { id: "message.user", extensions: {} };
    const first = createTextContent("content-1", "你好");
    const second = createTextContent("content-2", "second");
    const relation = createRelation("entry-2");
    const metadata = { sequence: 1, labels: ["primary"] } as const;
    const extensions = { "provider.trace": { enabled: false } } as const;

    const built = new MessageEntryBuilder("entry-1", role)
      .addContent(first)
      .addContent(second)
      .addRelation(relation)
      .withMetadata(metadata)
      .withExtensions(extensions)
      .build();
    const direct: MessageEntry = {
      id: "entry-1",
      kind: "message.entry",
      role,
      content: [first, second],
      relations: [relation],
      metadata,
      extensions,
    };

    // Structural equality proves the convenience API adds no hidden fields,
    // defaults, protocol state, task data, or semantic normalization.
    expect(built).toEqual(direct);
    expect(Object.keys(built)).toEqual([
      "id",
      "kind",
      "role",
      "content",
      "relations",
      "metadata",
      "extensions",
    ]);
  });

  it("preserves supplied objects and insertion order by identity", () => {
    const role: MessageRole = { id: "provider.reviewer", extensions: {} };
    const first = createTextContent("content-1", "first");
    const second: MessageContent = {
      id: "content-2",
      kind: "provider.citation",
      raw: {
        bytes: new Uint8Array([1, 2]),
        truncated: false,
        metadata: {},
      },
      metadata: {},
      extensions: {},
    };
    const firstRelation = createRelation("entry-2");
    const secondRelation = createRelation("entry-3");
    const metadata = { order: [1, 2] };
    const extensions = { "provider.mode": "review" };

    const entry = new MessageEntryBuilder("entry-1", role)
      .addContent(first)
      .addContent(second)
      .addRelation(firstRelation)
      .addRelation(secondRelation)
      .withMetadata(metadata)
      .withExtensions(extensions)
      .build();

    // Direct-construction equivalence retains nested references while only the
    // Builder-owned ordered collections are snapshotted.
    expect(entry.role).toBe(role);
    expect(entry.content).toEqual([first, second]);
    expect(entry.content[0]).toBe(first);
    expect(entry.content[1]).toBe(second);
    expect(entry.relations).toEqual([firstRelation, secondRelation]);
    expect(entry.relations[0]).toBe(firstRelation);
    expect(entry.relations[1]).toBe(secondRelation);
    expect(entry.metadata).toBe(metadata);
    expect(entry.extensions).toBe(extensions);
  });

  it("supplies only required empty maps and relations by default", () => {
    const content = createTextContent("content-1", "text");
    const entry = new MessageEntryBuilder("entry-1", {
      id: "message.assistant",
      extensions: {},
    })
      .addContent(content)
      .build();

    // Defaults satisfy required containers without inventing semantic metadata,
    // extensions, relations, children, model settings, or protocol fields.
    expect(entry.relations).toEqual([]);
    expect(entry.metadata).toEqual({});
    expect(entry.extensions).toEqual({});
    expect(Object.hasOwn(entry, "children")).toBe(false);
  });

  it("returns frozen collection snapshots independent from later Builder changes", () => {
    const builder = new MessageEntryBuilder("entry-1", {
      id: "message.user",
      extensions: {},
    }).addContent(createTextContent("content-1", "first"));
    const first = builder.build();

    // Mutating the Builder after build creates new future state and cannot alter
    // the already-returned entry or its collection membership.
    builder.addContent(createTextContent("content-2", "second"));
    const second = builder.build();

    expect(first.content.map(({ id }) => id)).toEqual(["content-1"]);
    expect(second.content.map(({ id }) => id)).toEqual(["content-1", "content-2"]);
    expect(first.content).not.toBe(second.content);
    expect(first.relations).not.toBe(second.relations);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.content)).toBe(true);
    expect(Object.isFrozen(first.relations)).toBe(true);
    expect(() => (first.content as MessageContent[]).push(createTextContent("later", "x"))).toThrow(
      TypeError,
    );
  });

  it("validates the complete local entry only when building", () => {
    const invalidRole = { id: "invalid role", extensions: {} } as MessageRole;
    const invalidContent = {
      id: "content-1",
      kind: "content.text",
      metadata: {},
      extensions: {},
    } as MessageContent;
    const invalidRelation = {
      sourceId: "entry-1",
      targetId: "invalid target",
      type: "message.precedes",
      metadata: {},
    } as MessageRelation;

    // Typed callers cannot provide these shapes without an assertion, but the
    // runtime guard must still protect JavaScript and trust-boundary consumers.
    expect(() =>
      new MessageEntryBuilder("entry-1", invalidRole)
        .addContent(createTextContent("content-1", "text"))
        .build(),
    ).toThrow(TypeError);
    expect(() =>
      new MessageEntryBuilder("invalid id", validRole())
        .addContent(createTextContent("content-1", "text"))
        .build(),
    ).toThrow(TypeError);
    expect(() => new MessageEntryBuilder("entry-1", validRole()).build()).toThrow(TypeError);
    expect(() =>
      new MessageEntryBuilder("entry-1", validRole()).addContent(invalidContent).build(),
    ).toThrow(TypeError);
    expect(() =>
      new MessageEntryBuilder("entry-1", validRole())
        .addContent(createTextContent("content-1", "text"))
        .addRelation(invalidRelation)
        .build(),
    ).toThrow(TypeError);
    expect(() =>
      new MessageEntryBuilder("entry-1", validRole())
        .addContent(createTextContent("content-1", "text"))
        .withMetadata({ invalid: Number.NaN })
        .build(),
    ).toThrow(TypeError);
    expect(() =>
      new MessageEntryBuilder("entry-1", validRole())
        .addContent(createTextContent("content-1", "text"))
        .withExtensions([] as unknown as Extensions)
        .build(),
    ).toThrow(TypeError);
  });

  it("does not mutate or freeze caller-owned nested values", () => {
    const role: MessageRole = { id: "message.user", extensions: {} };
    const content = createTextContent("content-1", "text");
    const relation = createRelation("entry-2");
    const metadata = { mutableByOwner: true };
    const extensions = { "provider.flag": true };

    new MessageEntryBuilder("entry-1", role)
      .addContent(content)
      .addRelation(relation)
      .withMetadata(metadata)
      .withExtensions(extensions)
      .build();

    // Freezing the Builder-owned envelope must not silently take ownership of
    // domain values that the caller may also retain outside the built entry.
    expect(Object.isFrozen(role)).toBe(false);
    expect(Object.isFrozen(content)).toBe(false);
    expect(Object.isFrozen(relation)).toBe(false);
    expect(Object.isFrozen(metadata)).toBe(false);
    expect(Object.isFrozen(extensions)).toBe(false);
  });

  it("exposes only the reviewed fluent and build signatures", () => {
    // Exact method signatures lock construction to existing domain types without
    // introducing a second options model or accepting task/protocol data.
    expectTypeOf(MessageEntryBuilder).toBeConstructibleWith("entry-1", validRole());
    expectTypeOf<MessageEntryBuilder["addContent"]>().toEqualTypeOf<
      (content: MessageContent) => MessageEntryBuilder
    >();
    expectTypeOf<MessageEntryBuilder["addRelation"]>().toEqualTypeOf<
      (relation: MessageRelation) => MessageEntryBuilder
    >();
    expectTypeOf<MessageEntryBuilder["withMetadata"]>().toEqualTypeOf<
      (metadata: Readonly<Record<string, JsonValue>>) => MessageEntryBuilder
    >();
    expectTypeOf<MessageEntryBuilder["withExtensions"]>().toEqualTypeOf<
      (extensions: Extensions) => MessageEntryBuilder
    >();
    expectTypeOf<MessageEntryBuilder["build"]>().toEqualTypeOf<() => MessageEntry>();
  });
});

/** Creates the valid standard role shared by rejection cases. */
function validRole(): MessageRole {
  // Return a fresh role so one rejection case cannot affect another through a
  // shared mutable test object.
  return { id: "message.user", extensions: {} };
}
