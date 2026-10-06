// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { isMessageGroup, type MessageGroup } from "./message-group.js";

/** Creates a complete group while allowing one scenario to replace fields. */
function createGroup(overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  // Every required container field is explicit so no builder behavior leaks into
  // this validator step.
  return {
    id: "group-1",
    kind: "message.group",
    composition: "container",
    children: [],
    relations: [],
    metadata: {},
    extensions: {},
    ...overrides,
  };
}

/** Creates a shallow entry child; its payload may intentionally remain invalid. */
function createEntry(id: string): Record<string, unknown> {
  // Group validation needs only the direct entry identity and discriminator.
  return {
    id,
    kind: "message.entry",
    role: { id: "message.user", extensions: {} },
    content: [],
    relations: [],
    metadata: {},
    extensions: {},
  };
}

describe("isMessageGroup", () => {
  it("accepts empty standard and provider-defined containers", () => {
    // No local rule requires a child, and open group kinds remain extensible.
    expect(isMessageGroup(createGroup())).toBe(true);
    expect(isMessageGroup(createGroup({ kind: "provider.timeline" }))).toBe(true);
    expect(isMessageGroup(createGroup({ kind: "message.root" }))).toBe(true);
  });

  it("narrows unknown input to MessageGroup", () => {
    const candidate: unknown = createGroup();

    // Guard before reading children so TypeScript proves the package predicate.
    if (!isMessageGroup(candidate)) {
      throw new Error("Expected the fixture to satisfy MessageGroup.");
    }
    expect(candidate.composition).toBe("container");
    expectTypeOf(isMessageGroup).toEqualTypeOf<(value: unknown) => value is MessageGroup>();
  });

  it("preserves direct child order and identity", () => {
    const first = createEntry("entry-1");
    const nested = createGroup({ id: "group-2", kind: "provider.history" });
    const children = [first, nested];
    const group = createGroup({ children });

    // Validation neither rebuilds, sorts, nor recursively transforms children.
    expect(isMessageGroup(group)).toBe(true);
    expect(group.children).toBe(children);
    expect((group.children as readonly unknown[])[0]).toBe(first);
    expect((group.children as readonly unknown[])[1]).toBe(nested);
  });

  it("enforces direct child identity uniqueness", () => {
    // Parent collisions and duplicate siblings fail locally; case remains exact.
    expect(isMessageGroup(createGroup({ children: [createEntry("group-1")] }))).toBe(false);
    expect(
      isMessageGroup(createGroup({ children: [createEntry("entry-1"), createEntry("entry-1")] })),
    ).toBe(false);
    expect(
      isMessageGroup(createGroup({ children: [createEntry("entry-1"), createEntry("Entry-1")] })),
    ).toBe(true);
  });

  it("does not absorb recursive entry validation", () => {
    const incompleteEntry = createEntry("entry-1");

    // Empty content makes this child invalid as a standalone MessageEntry, but
    // group validation intentionally owns only the direct child edge and ID.
    expect(isMessageGroup(createGroup({ children: [incompleteEntry] }))).toBe(true);
  });

  it("rejects leaf fields and non-container composition", () => {
    // Role/content are reserved leaf channels even when otherwise harmless.
    expect(isMessageGroup(createGroup({ composition: "leaf" }))).toBe(false);
    expect(isMessageGroup(createGroup({ kind: "message.entry" }))).toBe(false);
    expect(isMessageGroup(createGroup({ role: { id: "message.user", extensions: {} } }))).toBe(
      false,
    );
    expect(isMessageGroup(createGroup({ content: [] }))).toBe(false);
  });

  it("rejects malformed direct child shapes", () => {
    const content = { id: "content-1", kind: "content.text", text: "wrong level" };

    // Content cannot become a tree child; nested containers require composition
    // and children, while entries cannot smuggle their own children collection.
    expect(isMessageGroup(createGroup({ children: [null] }))).toBe(false);
    expect(isMessageGroup(createGroup({ children: [content] }))).toBe(false);
    expect(
      isMessageGroup(createGroup({ children: [{ id: "group-2", kind: "message.group" }] })),
    ).toBe(false);
    expect(
      isMessageGroup(createGroup({ children: [{ ...createEntry("entry-1"), children: [] }] })),
    ).toBe(false);
    expect(
      isMessageGroup(
        createGroup({
          children: [{ id: "entry-1", kind: "message.entry", content: [] }],
        }),
      ),
    ).toBe(false);
    expect(isMessageGroup(createGroup({ children: [createEntry("bad id")] }))).toBe(false);
  });

  it("requires a dense ordinary child array without invoking getters", () => {
    const childGetter = vi.fn(() => createEntry("entry-1"));
    const accessorChildren = Object.defineProperty([], "0", {
      enumerable: true,
      get: childGetter,
    });
    Object.defineProperty(accessorChildren, "length", { value: 1 });
    const sparse = new Array<unknown>(1);

    // Descriptor-based traversal rejects unstable collections without reads.
    expect(isMessageGroup(createGroup({ children: {} }))).toBe(false);
    expect(isMessageGroup(createGroup({ children: sparse }))).toBe(false);
    expect(isMessageGroup(createGroup({ children: accessorChildren }))).toBe(false);
    expect(childGetter).not.toHaveBeenCalled();
  });

  it("validates relations and both JSON channels", () => {
    const relation = {
      sourceId: "group-1",
      targetId: "entry-1",
      type: "message.contains",
      metadata: {},
    };

    // Endpoint existence is deferred, but relation shape and JSON remain local.
    expect(isMessageGroup(createGroup({ relations: [relation] }))).toBe(true);
    expect(isMessageGroup(createGroup({ relations: [{ ...relation, type: "bad type" }] }))).toBe(
      false,
    );
    expect(isMessageGroup(createGroup({ metadata: [] }))).toBe(false);
    expect(isMessageGroup(createGroup({ extensions: { value: Number.NaN } }))).toBe(false);
  });

  it("requires own data fields and ignores unrelated getters", () => {
    for (const field of [
      "id",
      "kind",
      "composition",
      "children",
      "relations",
      "metadata",
      "extensions",
    ] as const) {
      const incomplete = createGroup();
      // Remove exactly one required descriptor per iteration.
      expect(Reflect.deleteProperty(incomplete, field)).toBe(true);
      expect(isMessageGroup(incomplete)).toBe(false);
    }

    const unknownGetter = vi.fn(() => "ignored");
    const extended = Object.defineProperty(createGroup(), "futureField", {
      enumerable: true,
      get: unknownGetter,
    });
    // Unknown extension points remain inert and do not affect container shape.
    expect(isMessageGroup(extended)).toBe(true);
    expect(unknownGetter).not.toHaveBeenCalled();
  });

  it("fails closed for non-record and revoked roots", () => {
    const revoked = Proxy.revocable(createGroup(), {});
    const nestedChildren = Proxy.revocable([], {});
    const nestedGroup = createGroup({ id: "group-2", children: nestedChildren.proxy });
    revoked.revoke();
    nestedChildren.revoke();

    // Invalid roots and hostile reflection never throw from the public guard.
    for (const candidate of [undefined, null, true, "group", [], revoked.proxy]) {
      expect(() => isMessageGroup(candidate)).not.toThrow();
      expect(isMessageGroup(candidate)).toBe(false);
    }
    expect(() => isMessageGroup(createGroup({ children: [nestedGroup] }))).not.toThrow();
    expect(isMessageGroup(createGroup({ children: [nestedGroup] }))).toBe(false);
  });
});
