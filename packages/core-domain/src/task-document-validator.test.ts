// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { isTaskDocument, type TaskDocument } from "./task-document.js";
import type { TaskGroupNode } from "./task-group-node.js";
import type { TaskNode } from "./task-node.js";
import type { TaskRelation } from "./task-relation.js";
import type { UnknownTaskNode } from "./unknown-task-node.js";

describe("isTaskDocument", () => {
  it("accepts a multilevel tree and resolves forward relations", () => {
    const forward = createRelation("input-1", "input-2", "task.precedes");
    const first = createLeaf("input-1", { relations: [forward] });
    const second = createLeaf("input-2", { kind: "vendor.input" });
    const section = createGroup("section", [first], "vendor.section");
    const root = createRoot([section, second]);
    const document = createDocument(root);

    // A relation may reference a later preorder node because resolution happens
    // after indexing. Exact tree and collection references remain untouched.
    expect(isTaskDocument(document)).toBe(true);
    expect(document.root).toBe(root);
    expect(root.children).toEqual([section, second]);
    expect(section.children[0]).toBe(first);
    expect(first.relations[0]).toBe(forward);
  });

  it("accepts future versions unknown Kinds and a resolvable self relation", () => {
    const self = createRelation("custom", "custom", "vendor.self");
    const custom = createLeaf("custom", {
      kind: "vendor.future_input",
      relations: [self],
    });
    const document = createDocument(createRoot([custom]), {
      version: " future-version ",
    });

    // Version and descendant Kind remain opaque/open, while a self edge is valid
    // because its two independently stored endpoints resolve in this document.
    expect(isTaskDocument(document)).toBe(true);
    expect(document.version).toBe(" future-version ");
    expect(custom.kind).toBe("vendor.future_input");
  });

  it.each([undefined, null, true, 1, "document", [], () => undefined])(
    "rejects the non-record document %j",
    (candidate) => {
      // TaskDocument is always a named non-array envelope.
      expect(isTaskDocument(candidate)).toBe(false);
    },
  );

  it("rejects missing and accessor-backed envelope fields", () => {
    const rootGetter = vi.fn(() => {
      // Throw if validation reads an accessor instead of inspecting it.
      throw new Error("root getter must not run");
    });
    const accessorRoot = {
      version: "1.0",
      get root(): never {
        // Route any forbidden read through the spy so execution is observable.
        return rootGetter();
      },
      metadata: {},
      extensions: {},
    };

    // Every envelope field is required as an own data property; no default root
    // or preservation map is inferred from outer request state.
    expect(
      isTaskDocument({
        version: "1.0",
        root: createRoot([]),
        extensions: {},
      }),
    ).toBe(false);
    expect(isTaskDocument(accessorRoot)).toBe(false);
    expect(rootGetter).not.toHaveBeenCalled();
  });

  it("requires a nonblank version and exact task.root container", () => {
    const leafRoot = createLeaf("root");
    const wrongKindRoot = createGroup("root", [], "vendor.root");
    const typedLeafKindRoot = createGroup("root", [], "task.input.conversation");

    // Version syntax remains otherwise opaque. Root must be the standard entry
    // container and cannot be a leaf or a group with another Kind identity.
    expect(isTaskDocument(createDocument(createRoot([]), { version: "" }))).toBe(false);
    expect(isTaskDocument(createDocument(createRoot([]), { version: " \t\n" }))).toBe(false);
    expect(isTaskDocument({ ...createDocument(createRoot([])), version: 1 })).toBe(false);
    expect(isTaskDocument({ ...createDocument(createRoot([])), root: leafRoot })).toBe(false);
    expect(isTaskDocument(createDocument(wrongKindRoot))).toBe(false);
    expect(isTaskDocument(createDocument(typedLeafKindRoot))).toBe(false);
  });

  it("visits and rejects invalid descendant semantics", () => {
    const invalidDescendant = {
      ...createLeaf("invalid"),
      metadata: { notFinite: Number.NaN },
    };
    const section = createGroup("section", [invalidDescendant as TaskNode]);
    const document = createDocument(createRoot([section]));

    // Parent local validation inspects only the direct surface. Whole-document
    // traversal later makes the descendant current and detects invalid metadata.
    expect(isTaskDocument(document)).toBe(false);
  });

  it("enforces one document-wide node ID namespace", () => {
    const left = createGroup("left", [createLeaf("duplicate")]);
    const right = createGroup("right", [createLeaf("duplicate")]);
    const shared = createLeaf("shared");

    // Sibling-local rules cannot see collisions across branches or repeated
    // object occurrences, so the document index must reject both cases.
    expect(isTaskDocument(createDocument(createRoot([left, right])))).toBe(false);
    expect(
      isTaskDocument(
        createDocument(
          createRoot([createGroup("first", [shared]), createGroup("second", [shared])]),
        ),
      ),
    ).toBe(false);
  });

  it("resolves relation endpoints only inside the complete document", () => {
    const first = createLeaf("first");
    const second = createLeaf("second");

    /** Builds the same two-node tree with one relation on the first node. */
    function withRelation(relation: TaskRelation): TaskDocument {
      // A stable topology isolates endpoint resolution from traversal, Kind,
      // version, and metadata differences across cases.
      return createDocument(createRoot([{ ...first, relations: [relation] }, second]));
    }

    expect(isTaskDocument(withRelation(createRelation("first", "second")))).toBe(true);
    expect(isTaskDocument(withRelation(createRelation("missing", "second")))).toBe(false);
    expect(isTaskDocument(withRelation(createRelation("first", "missing")))).toBe(false);
  });

  it("rejects ancestor cycles without recursive overflow", () => {
    const firstChildren: TaskNode[] = [];
    const secondChildren: TaskNode[] = [];
    const first = createGroup("first", firstChildren);
    const second = createGroup("second", secondChildren);
    firstChildren.push(second);
    secondChildren.push(first);
    const document = createDocument(createRoot([first]));

    // Distinct IDs avoid local collision failures, proving active-path object
    // tracking detects the cycle before revisiting or overflowing the call stack.
    expect(isTaskDocument(document)).toBe(false);
  });

  it("handles a deeply nested valid tree iteratively", () => {
    let child: TaskNode = createLeaf("deep-leaf");
    for (let index = 0; index < 2_000; index += 1) {
      // Build bottom-up with unique IDs; validation must not consume JavaScript
      // recursion depth regardless of the resulting chain length.
      child = createGroup(`container-${String(index)}`, [child]);
    }
    const document = createDocument(createRoot([child]));

    expect(isTaskDocument(document)).toBe(true);
  });

  it("validates document metadata and extensions independently", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const root = createRoot([]);

    // Valid tree structure cannot mask a non-record, host object, non-finite
    // number, cycle, or other non-portable envelope preservation value.
    expect(isTaskDocument({ ...createDocument(root), metadata: [] })).toBe(false);
    expect(isTaskDocument({ ...createDocument(root), extensions: new Date() })).toBe(false);
    expect(
      isTaskDocument({ ...createDocument(root), metadata: { invalid: Number.POSITIVE_INFINITY } }),
    ).toBe(false);
    expect(isTaskDocument({ ...createDocument(root), extensions: cyclic })).toBe(false);
  });

  it("allows unknown envelope fields without consulting them", () => {
    const unknownGetter = vi.fn(() => {
      // Throw if validation starts interpreting application-owned state.
      throw new Error("unknown getter must not run");
    });
    const document = {
      ...createDocument(createRoot([])),
      futureOption: { enabled: true },
      get applicationState(): never {
        // Route a forbidden read through the spy so execution is observable.
        return unknownGetter();
      },
    };

    // Structural openness preserves unknown fields while validation depends only
    // on the document contract and complete Task tree.
    expect(isTaskDocument(document)).toBe(true);
    expect(unknownGetter).not.toHaveBeenCalled();
    expect(document.futureOption).toEqual({ enabled: true });
  });

  it("contains Proxy failures and leaves valid documents unchanged", () => {
    const documentProxy = new Proxy(
      {},
      {
        ownKeys: () => {
          // Simulate a hostile reflection boundary at the envelope.
          throw new Error("document failure");
        },
      },
    );
    const revokedDocument = Proxy.revocable({}, {});
    revokedDocument.revoke();
    const document = createDocument(createRoot([createLeaf("child")]));
    const original = structuredClone(document);

    // Hostile inputs fail closed, while successful validation never normalizes,
    // sorts, freezes, copies into, or mutates caller-owned data.
    expect(isTaskDocument(documentProxy)).toBe(false);
    expect(isTaskDocument(revokedDocument.proxy)).toBe(false);
    expect(isTaskDocument(document)).toBe(true);
    expect(document).toEqual(original);
  });

  it("exposes the intended complete-document type-guard signature", () => {
    // Lock the public validator to a reusable unknown-input type predicate.
    expectTypeOf(isTaskDocument).toEqualTypeOf<(value: unknown) => value is TaskDocument>();
  });
});

/** Creates one unknown leaf with optional Kind and relation overrides. */
function createLeaf(
  id: string,
  options: {
    readonly kind?: string;
    readonly relations?: readonly TaskRelation[];
  } = {},
): UnknownTaskNode {
  // Explicit shared fields form a stable valid baseline without typed payload,
  // raw data, child collection, defaults from builders, or execution behavior.
  return {
    id,
    kind: options.kind ?? "vendor.input",
    composition: "leaf",
    relations: options.relations ?? [],
    metadata: {},
    extensions: {},
  };
}

/** Creates one Task container with caller-selected ordered children and Kind. */
function createGroup(
  id: string,
  children: readonly TaskNode[],
  kind = "task.group",
  relations: readonly TaskRelation[] = [],
): TaskGroupNode {
  // Child and relation references remain exact so traversal tests detect any
  // copying, sorting, or normalization side effect.
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

/** Creates the exact standard TaskDocument root container. */
function createRoot(
  children: readonly TaskNode[],
  relations: readonly TaskRelation[] = [],
): TaskGroupNode {
  // Root identity is isolated in one helper so descendant groups remain open
  // while every valid document has the same required entry-point semantics.
  return createGroup("root", children, "task.root", relations);
}

/** Creates one document with explicit optional envelope overrides. */
function createDocument(
  root: TaskGroupNode,
  options: {
    readonly version?: string;
    readonly metadata?: TaskDocument["metadata"];
    readonly extensions?: TaskDocument["extensions"];
  } = {},
): TaskDocument {
  // Nullish defaults keep the ordinary fixture concise while every supplied
  // non-nullish override remains the exact caller-owned value.
  return {
    version: options.version ?? "1.0",
    root,
    metadata: options.metadata ?? {},
    extensions: options.extensions ?? {},
  };
}

/** Creates one directed relation with independent stored endpoint IDs. */
function createRelation(
  sourceId: string,
  targetId: string,
  type = "task.references",
): TaskRelation {
  // No endpoint lookup occurs during construction, allowing forward, missing,
  // and self-reference scenarios to share the same fixture path.
  return {
    sourceId,
    targetId,
    type,
    metadata: {},
  };
}
