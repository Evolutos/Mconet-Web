// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { isMessageEntry, type MessageEntry } from "./message-entry.js";

/** Creates one complete entry while allowing a test to replace selected fields. */
function createEntry(overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  // The two content values make order preservation observable in valid cases.
  return {
    id: "message-1",
    kind: "message.entry",
    role: { id: "message.user", extensions: {} },
    content: [
      { id: "content-1", kind: "content.text", text: "first", metadata: {}, extensions: {} },
      { id: "content-2", kind: "content.text", text: "second", metadata: {}, extensions: {} },
    ],
    relations: [],
    metadata: {},
    extensions: {},
    ...overrides,
  };
}

describe("isMessageEntry", () => {
  it("accepts a standard entry without changing content order", () => {
    const entry = createEntry();
    const content = entry.content as readonly Record<string, unknown>[];

    // A boolean validator observes the original collection without rebuilding,
    // sorting, or replacing either content object.
    expect(isMessageEntry(entry)).toBe(true);
    expect((entry.content as readonly unknown[])[0]).toBe(content[0]);
    expect(content.map(({ id }) => id)).toEqual(["content-1", "content-2"]);
  });

  it("narrows unknown input to MessageEntry", () => {
    const candidate: unknown = createEntry();

    // Guard before accessing the role so TypeScript verifies the public type
    // predicate rather than relying on a test-only assertion.
    if (!isMessageEntry(candidate)) {
      throw new Error("Expected the fixture to satisfy MessageEntry.");
    }
    expect(candidate.role.id).toBe("message.user");
    expectTypeOf(isMessageEntry).toEqualTypeOf<(value: unknown) => value is MessageEntry>();
  });

  it("accepts unknown roles and open content with bounded raw data", () => {
    const unknownContent = {
      id: "content-citation",
      kind: "provider.content.citation",
      raw: {
        mediaType: "application/octet-stream",
        bytes: new Uint8Array([1, 2]),
        truncated: false,
        metadata: { source: "provider" },
      },
      metadata: { language: "zh-CN" },
      extensions: { "provider.style": { emphasis: true } },
    };
    const entry = createEntry({
      role: { id: "provider.moderator", semantic: "observer", extensions: {} },
      content: [unknownContent],
    });

    // Domain validation remains open; later runtime scope checks decide whether
    // a selected integration supports the custom role and content kind.
    expect(isMessageEntry(entry)).toBe(true);
    expect((entry.content as readonly unknown[])[0]).toBe(unknownContent);
  });

  it("requires non-empty content while permitting an empty text value", () => {
    const emptyText = createEntry({
      content: [
        { id: "content-empty", kind: "content.text", text: "", metadata: {}, extensions: {} },
      ],
    });

    // Entry emptiness concerns the collection, not the payload string.
    expect(isMessageEntry(emptyText)).toBe(true);
    expect(isMessageEntry(createEntry({ content: [] }))).toBe(false);
  });

  it("enforces the entry discriminator and leaf shape", () => {
    // A container kind or any reserved children collection contradicts the
    // concrete leaf contract, including an apparently harmless empty array.
    expect(isMessageEntry(createEntry({ kind: "message.group" }))).toBe(false);
    expect(isMessageEntry(createEntry({ children: [] }))).toBe(false);
    expect(isMessageEntry(createEntry({ children: [createEntry()] }))).toBe(false);
  });

  it("rejects missing inherited and accessor-backed entry fields", () => {
    for (const field of [
      "id",
      "kind",
      "role",
      "content",
      "relations",
      "metadata",
      "extensions",
    ] as const) {
      const incomplete = createEntry();
      // Remove one field at a time so every required descriptor is proven.
      expect(Reflect.deleteProperty(incomplete, field)).toBe(true);
      expect(isMessageEntry(incomplete)).toBe(false);
    }

    const inherited = Object.create(createEntry()) as object;
    const roleGetter = vi.fn(() => ({ id: "message.user", extensions: {} }));
    const accessorRole = Object.defineProperty(createEntry(), "role", {
      enumerable: true,
      get: roleGetter,
    });
    // Inherited state and getters never satisfy the direct data contract.
    expect(isMessageEntry(inherited)).toBe(false);
    expect(isMessageEntry(accessorRole)).toBe(false);
    expect(roleGetter).not.toHaveBeenCalled();
  });

  it("delegates role and text-content invariants", () => {
    // Invalid open identity, role JSON, and concrete text fields must fail at
    // their single shared validators instead of receiving entry-specific rules.
    expect(isMessageEntry(createEntry({ role: { id: "message user", extensions: {} } }))).toBe(
      false,
    );
    expect(
      isMessageEntry(
        createEntry({ role: { id: "message.user", extensions: { value: undefined } } }),
      ),
    ).toBe(false);
    expect(
      isMessageEntry({
        ...createEntry(),
        content: [{ id: "content-1", kind: "content.text", metadata: {}, extensions: {} }],
      }),
    ).toBe(false);
  });

  it("rejects sparse accessor-backed and non-content arrays", () => {
    const sparse = new Array<unknown>(1);
    const arraySubclass = new (class extends Array<unknown> {})();
    arraySubclass.push({
      id: "content-1",
      kind: "content.text",
      text: "subclass",
      metadata: {},
      extensions: {},
    });
    const contentGetter = vi.fn(() => ({
      id: "content-1",
      kind: "content.text",
      text: "hidden",
      metadata: {},
      extensions: {},
    }));
    const accessorArray = Object.defineProperty([], "0", {
      enumerable: true,
      get: contentGetter,
    });
    Object.defineProperty(accessorArray, "length", { value: 1 });

    // Ordered content must be a dense ordinary array of stored values.
    expect(isMessageEntry(createEntry({ content: {} }))).toBe(false);
    expect(isMessageEntry(createEntry({ content: sparse }))).toBe(false);
    expect(isMessageEntry(createEntry({ content: arraySubclass }))).toBe(false);
    expect(isMessageEntry(createEntry({ content: accessorArray }))).toBe(false);
    expect(isMessageEntry(createEntry({ content: ["text"] }))).toBe(false);
    expect(contentGetter).not.toHaveBeenCalled();
  });

  it("validates unknown content and its optional raw payload", () => {
    const baseUnknown = {
      id: "content-1",
      kind: "provider.content.custom",
      metadata: {},
      extensions: {},
    };

    // Open kinds remain valid, but their shared fields and present raw payload
    // still have to satisfy portable domain shapes.
    expect(isMessageEntry(createEntry({ content: [{ ...baseUnknown, kind: "bad kind" }] }))).toBe(
      false,
    );
    expect(isMessageEntry(createEntry({ content: [{ ...baseUnknown, raw: undefined }] }))).toBe(
      false,
    );
    expect(
      isMessageEntry(
        createEntry({
          content: [{ ...baseUnknown, raw: { bytes: [], truncated: false, metadata: {} } }],
        }),
      ),
    ).toBe(false);
    expect(
      isMessageEntry(
        createEntry({ content: [{ ...baseUnknown, extensions: { value: Number.NaN } }] }),
      ),
    ).toBe(false);

    const byteProxy = Proxy.revocable(new Uint8Array([1]), {});
    byteProxy.revoke();
    const hostileRaw = { bytes: byteProxy.proxy, truncated: false, metadata: {} };
    // A revoked byte view is invalid but cannot throw through the entry guard.
    expect(() =>
      isMessageEntry(createEntry({ content: [{ ...baseUnknown, raw: hostileRaw }] })),
    ).not.toThrow();
    expect(isMessageEntry(createEntry({ content: [{ ...baseUnknown, raw: hostileRaw }] }))).toBe(
      false,
    );
  });

  it("validates ordered relation structure without resolving endpoints", () => {
    const relations = [
      { sourceId: "message-1", targetId: "message-2", type: "message.reply", metadata: {} },
      {
        sourceId: "message-1",
        targetId: "message-3",
        type: "provider.cites",
        metadata: { rank: 1 },
      },
    ];
    const entry = createEntry({ relations });

    // Endpoint existence is document-wide, while local syntax, JSON shape, and
    // order can be verified without traversing a document.
    expect(isMessageEntry(entry)).toBe(true);
    expect(entry.relations).toBe(relations);
    expect(isMessageEntry(createEntry({ relations: {} }))).toBe(false);
    expect(isMessageEntry(createEntry({ relations: ["relation"] }))).toBe(false);
    expect(
      isMessageEntry(createEntry({ relations: [{ ...relations[0], type: "bad type" }] })),
    ).toBe(false);
    expect(isMessageEntry(createEntry({ relations: [{ ...relations[0], metadata: [] }] }))).toBe(
      false,
    );
  });

  it("rejects malformed entry JSON and ignores unknown getters", () => {
    const unknownGetter = vi.fn(() => "ignored");
    const extended = Object.defineProperty(createEntry(), "futureField", {
      enumerable: true,
      get: unknownGetter,
    });

    // Known JSON channels are strict; unrelated future descriptors stay inert.
    expect(isMessageEntry(createEntry({ metadata: { value: undefined } }))).toBe(false);
    expect(isMessageEntry(createEntry({ extensions: [] }))).toBe(false);
    expect(isMessageEntry(extended)).toBe(true);
    expect(unknownGetter).not.toHaveBeenCalled();
  });

  it.each([undefined, null, true, 1, "entry", [], () => undefined])(
    "rejects the non-object entry root %j",
    (candidate) => {
      // An entry is a named leaf record rather than any primitive or array.
      expect(isMessageEntry(candidate)).toBe(false);
    },
  );

  it("fails closed for revoked entry and nested-array proxies", () => {
    const entryProxy = Proxy.revocable(createEntry(), {});
    const contentProxy = Proxy.revocable(createEntry().content as unknown[], {});
    entryProxy.revoke();
    contentProxy.revoke();

    // Reflection failures at either nesting level become false, never throws.
    expect(() => isMessageEntry(entryProxy.proxy)).not.toThrow();
    expect(isMessageEntry(entryProxy.proxy)).toBe(false);
    expect(() => isMessageEntry(createEntry({ content: contentProxy.proxy }))).not.toThrow();
    expect(isMessageEntry(createEntry({ content: contentProxy.proxy }))).toBe(false);
  });
});
