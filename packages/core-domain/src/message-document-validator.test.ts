// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { isMessageDocument, type MessageDocument } from "./message-document.js";

/** Creates one complete text entry with explicit document-local IDs. */
function createEntry(
  id: string,
  contentId: string,
  relations: readonly Record<string, unknown>[] = [],
): Record<string, unknown> {
  // All local fields are explicit so document tests exercise only whole-tree rules.
  return {
    id,
    kind: "message.entry",
    role: { id: "message.user", extensions: {} },
    content: [{ id: contentId, kind: "content.text", text: id, metadata: {}, extensions: {} }],
    relations,
    metadata: {},
    extensions: {},
  };
}

/** Creates one complete group with caller-selected identity, kind, and children. */
function createGroup(
  id: string,
  kind: string,
  children: readonly Record<string, unknown>[] = [],
  relations: readonly Record<string, unknown>[] = [],
): Record<string, unknown> {
  // Group construction preserves the exact child and relation arrays by identity.
  return {
    id,
    kind,
    composition: "container",
    children,
    relations,
    metadata: {},
    extensions: {},
  };
}

/** Creates a document around one root without relying on a future builder. */
function createDocument(
  root: Record<string, unknown> = createGroup("root", "message.root"),
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  // Independent JSON maps prevent one negative fixture from contaminating another.
  return {
    version: "1.0",
    purpose: "input",
    root,
    metadata: {},
    extensions: {},
    ...overrides,
  };
}

describe("isMessageDocument", () => {
  it("accepts a multilevel tree with a forward relation without reordering", () => {
    const forward = {
      sourceId: "entry-1",
      targetId: "entry-2",
      type: "message.precedes",
      metadata: {},
    };
    const first = createEntry("entry-1", "content-1", [forward]);
    const second = createEntry("entry-2", "content-2");
    const history = createGroup("history", "message.group", [first]);
    const current = createGroup("current", "provider.current", [second]);
    const children = [history, current];
    const root = createGroup("root", "message.root", children);
    const document = createDocument(root);

    // The second-pass endpoint lookup permits forward references while all arrays
    // and objects remain the caller's original instances and order.
    expect(isMessageDocument(document)).toBe(true);
    expect(document.root).toBe(root);
    expect(root.children).toBe(children);
    expect((history.children as readonly unknown[])[0]).toBe(first);
  });

  it("narrows unknown input to MessageDocument", () => {
    const candidate: unknown = createDocument();

    // Guard before root access so TypeScript proves the public predicate signature.
    if (!isMessageDocument(candidate)) {
      throw new Error("Expected the fixture to satisfy MessageDocument.");
    }
    expect(candidate.root.kind).toBe("message.root");
    expectTypeOf(isMessageDocument).toEqualTypeOf<(value: unknown) => value is MessageDocument>();
  });

  it.each(["input", "output", "context", "provider.review_context"])(
    "accepts the open document purpose %s",
    (purpose) => {
      // Standard and integration-defined purposes use one portable identifier rule.
      expect(isMessageDocument(createDocument(undefined, { purpose }))).toBe(true);
    },
  );

  it("accepts opaque nonblank future versions without normalization", () => {
    const document = createDocument(undefined, { version: "future-version" });

    // The shared boundary does not invent semantic-version parsing or rewrite text.
    expect(isMessageDocument(document)).toBe(true);
    expect(document.version).toBe("future-version");
  });

  it("rejects invalid envelope fields and requires own data properties", () => {
    for (const field of ["version", "purpose", "root", "metadata", "extensions"] as const) {
      const incomplete = createDocument();
      // Delete one field at a time to prove every descriptor is required.
      expect(Reflect.deleteProperty(incomplete, field)).toBe(true);
      expect(isMessageDocument(incomplete)).toBe(false);
    }

    expect(isMessageDocument(createDocument(undefined, { version: "" }))).toBe(false);
    expect(isMessageDocument(createDocument(undefined, { version: " \t" }))).toBe(false);
    expect(isMessageDocument(createDocument(undefined, { version: 1 }))).toBe(false);
    expect(isMessageDocument(createDocument(undefined, { purpose: "bad purpose" }))).toBe(false);
    expect(isMessageDocument(createDocument(undefined, { metadata: [] }))).toBe(false);
  });

  it("requires the exact message.root container", () => {
    // A leaf or ordinary group cannot become the traversal root by shape alone.
    expect(isMessageDocument(createDocument(createEntry("entry-1", "content-1")))).toBe(false);
    expect(isMessageDocument(createDocument(createGroup("root", "message.group")))).toBe(false);
    expect(
      isMessageDocument(
        createDocument(createGroup("root", "message.root"), { root: { id: "root" } }),
      ),
    ).toBe(false);
  });

  it("composes nested Entry and Group validators", () => {
    const emptyEntry = createEntry("entry-1", "content-1");
    emptyEntry.content = [];
    const invalidGroup = createGroup("group-1", "message.group");
    invalidGroup.role = { id: "message.user", extensions: {} };

    // Concrete local invariants remain owned by their dedicated predicates.
    expect(
      isMessageDocument(createDocument(createGroup("root", "message.root", [emptyEntry]))),
    ).toBe(false);
    expect(
      isMessageDocument(createDocument(createGroup("root", "message.root", [invalidGroup]))),
    ).toBe(false);
  });

  it("enforces one global element and content ID namespace", () => {
    const duplicateElements = createGroup("root", "message.root", [
      createGroup("left", "message.group", [createEntry("same", "content-1")]),
      createGroup("right", "message.group", [createEntry("same", "content-2")]),
    ]);
    const duplicateContent = createGroup("root", "message.root", [
      createGroup("left", "message.group", [createEntry("entry-1", "same")]),
      createGroup("right", "message.group", [createEntry("entry-2", "same")]),
    ]);
    const crossDomain = createGroup("root", "message.root", [createEntry("entry-1", "root")]);

    // These duplicates occur outside one direct sibling list and therefore prove
    // the document-level shared namespace rather than the Group-local check.
    for (const root of [duplicateElements, duplicateContent, crossDomain]) {
      expect(isMessageDocument(createDocument(root))).toBe(false);
    }
  });

  it("rejects element-shaped values in the content collection", () => {
    const embeddedGroup = createGroup("embedded", "provider.group");
    embeddedGroup.metadata = {};
    embeddedGroup.extensions = {};
    const entry = createEntry("entry-1", "content-1");
    entry.content = [embeddedGroup];

    // Structural overlap cannot erase the MessageElement/MessageContent boundary.
    expect(isMessageDocument(createDocument(createGroup("root", "message.root", [entry])))).toBe(
      false,
    );
  });

  it("resolves relations only against element IDs", () => {
    const second = createEntry("entry-2", "content-2");
    const withRelation = (sourceId: string, targetId: string): Record<string, unknown> => {
      // Use the same topology so only endpoint selection changes per assertion.
      const relation = { sourceId, targetId, type: "message.precedes", metadata: {} };
      const first = createEntry("entry-1", "content-1", [relation]);
      return createDocument(createGroup("root", "message.root", [first, second]));
    };

    expect(isMessageDocument(withRelation("entry-1", "entry-2"))).toBe(true);
    expect(isMessageDocument(withRelation("missing", "entry-2"))).toBe(false);
    expect(isMessageDocument(withRelation("entry-1", "missing"))).toBe(false);
    expect(isMessageDocument(withRelation("entry-1", "content-2"))).toBe(false);
  });

  it("rejects indirect cycles without recursive overflow", () => {
    const first = createGroup("first", "message.group");
    const second = createGroup("second", "message.group", [first]);
    first.children = [second];
    const document = createDocument(createGroup("root", "message.root", [first]));

    // Distinct IDs force the active-object path detector, not duplicate IDs, to fail.
    expect(() => isMessageDocument(document)).not.toThrow();
    expect(isMessageDocument(document)).toBe(false);
  });

  it("handles a deeply nested valid tree iteratively", () => {
    let element = createEntry("entry-0", "content-0");
    for (let index = 1; index < 1_500; index += 1) {
      // Each level owns a distinct ID and single child, exercising the explicit stack.
      element = createGroup(`container-${index}`, "provider.container", [element]);
    }
    const document = createDocument(createGroup("root", "message.root", [element]));

    expect(() => isMessageDocument(document)).not.toThrow();
    expect(isMessageDocument(document)).toBe(true);
  });

  it("validates document JSON while ignoring unrelated getters", () => {
    const unknownGetter = vi.fn(() => "ignored");
    const extended = Object.defineProperty(createDocument(), "futureField", {
      enumerable: true,
      get: unknownGetter,
    });

    // Known JSON fields remain strict and future envelope descriptors stay inert.
    expect(
      isMessageDocument(createDocument(undefined, { extensions: { value: Number.NaN } })),
    ).toBe(false);
    expect(isMessageDocument(extended)).toBe(true);
    expect(unknownGetter).not.toHaveBeenCalled();
  });

  it("fails closed for revoked roots and nested elements", () => {
    const revokedDocument = Proxy.revocable(createDocument(), {});
    const revokedChild = Proxy.revocable(createEntry("entry-1", "content-1"), {});
    const nested = createDocument(createGroup("root", "message.root", [revokedChild.proxy]));
    revokedDocument.revoke();
    revokedChild.revoke();

    // Reflection failures at either level are invalid boolean results, never errors.
    expect(() => isMessageDocument(revokedDocument.proxy)).not.toThrow();
    expect(isMessageDocument(revokedDocument.proxy)).toBe(false);
    expect(() => isMessageDocument(nested)).not.toThrow();
    expect(isMessageDocument(nested)).toBe(false);
  });
});
