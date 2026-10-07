// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { ConversationInputNode } from "./conversation-input-node.js";
import type { GenerationParametersNode } from "./generation-parameters-node.js";
import type { MessageDocument } from "./message-document.js";
import type { TaskGroupNode } from "./task-group-node.js";
import { isTaskNode, type TaskNode } from "./task-node.js";
import type { TaskRelation } from "./task-relation.js";
import type { UnknownTaskNode } from "./unknown-task-node.js";

describe("isTaskNode", () => {
  it("accepts an unknown leaf and narrows unknown input", () => {
    const candidate: unknown = createUnknownLeaf("review-1", "vendor.review");

    // Unknown open Kinds remain valid preservation leaves without registration,
    // typed payloads, child collections, or SDK inheritance.
    expect(isTaskNode(candidate)).toBe(true);
    if (!isTaskNode(candidate)) {
      throw new Error("Expected the task node test value to be valid.");
    }

    // Assignment proves successful local validation narrows to the public union.
    const node: TaskNode = candidate;
    expect(node.id).toBe("review-1");
    expect(node.kind).toBe("vendor.review");
  });

  it("accepts both typed leaf variants with complete payloads", () => {
    const messages = createMessageDocument();
    const conversation = createConversationNode("conversation", messages);
    const parameters = createParametersNode("parameters", {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 256,
      stop: ["DONE"],
      seed: 7,
    });

    // Payload references remain untouched while their local runtime storage is
    // proven complete enough for each fixed Kind discriminator.
    expect(isTaskNode(conversation)).toBe(true);
    expect(isTaskNode(parameters)).toBe(true);
    expect(conversation.messages).toBe(messages);
    expect(parameters.parameters.stop).toEqual(["DONE"]);
  });

  it("accepts ordered container children and unresolved local relations", () => {
    const first = createUnknownLeaf("input-1", "vendor.input");
    const second = createUnknownLeaf("input-2", "vendor.input");
    const relation = createRelation("missing-source", "missing-target", "vendor.precedes");
    const children = [first, second] as const;
    const relations = [relation] as const;
    const group = createGroup("root", children, relations);

    // Local validation preserves collection identity and order but cannot decide
    // endpoint existence without the later complete document index.
    expect(isTaskNode(group)).toBe(true);
    expect(group.children).toBe(children);
    expect(group.relations).toBe(relations);
    expect(group.relations[0]).toBe(relation);
  });

  it.each([undefined, null, true, 1, "node", [], () => undefined])(
    "rejects the non-record node %j",
    (candidate) => {
      // Every TaskNode is a named non-array record with the shared stored fields.
      expect(isTaskNode(candidate)).toBe(false);
    },
  );

  it("rejects missing accessor-backed and malformed shared fields", () => {
    const idGetter = vi.fn(() => {
      // Throw if local validation reads an accessor rather than inspecting it.
      throw new Error("id getter must not run");
    });
    const accessorId = {
      get id(): never {
        // Route a forbidden read through the spy so execution is observable.
        return idGetter();
      },
      kind: "vendor.input",
      composition: "leaf",
      relations: [],
      metadata: {},
      extensions: {},
    };

    // Missing maps, accessor IDs, blank IDs, invalid Kind syntax, and an unknown
    // composition all fail their own shared-field boundaries.
    expect(
      isTaskNode({
        id: "node",
        kind: "vendor.input",
        composition: "leaf",
        relations: [],
        extensions: {},
      }),
    ).toBe(false);
    expect(isTaskNode(accessorId)).toBe(false);
    expect(idGetter).not.toHaveBeenCalled();
    expect(isTaskNode({ ...createUnknownLeaf("node"), id: " \t\n" })).toBe(false);
    expect(isTaskNode({ ...createUnknownLeaf("node"), kind: "vendor..input" })).toBe(false);
    expect(isTaskNode({ ...createUnknownLeaf("node"), composition: "branch" })).toBe(false);
  });

  it("enforces leaf and container discriminator boundaries", () => {
    const leafWithChildren = {
      ...createUnknownLeaf("leaf"),
      children: [],
    };
    const conversationContainer = {
      ...createGroup("root"),
      kind: "task.input.conversation",
    };
    const containerWithPayload = {
      ...createGroup("root"),
      messages: createMessageDocument(),
    };

    // Even empty children are reserved for containers. Standard typed-leaf Kinds
    // and leaf payload channels cannot be reclassified as group data.
    expect(isTaskNode(leafWithChildren)).toBe(false);
    expect(isTaskNode(conversationContainer)).toBe(false);
    expect(isTaskNode(containerWithPayload)).toBe(false);
  });

  it("requires valid payloads for known typed-leaf Kinds", () => {
    const missingMessages = {
      ...createUnknownLeaf("conversation"),
      kind: "task.input.conversation",
    };
    const invalidMessages = {
      ...missingMessages,
      messages: { version: "1.0" },
    };
    const missingParameters = {
      ...createUnknownLeaf("parameters"),
      kind: "task.configuration",
    };
    const conflictingPayloads = {
      ...createConversationNode("conversation", createMessageDocument()),
      parameters: {},
    };

    // A known discriminator cannot fall back to UnknownTaskNode preservation,
    // and two typed payload channels cannot coexist on the same leaf.
    expect(isTaskNode(missingMessages)).toBe(false);
    expect(isTaskNode(invalidMessages)).toBe(false);
    expect(isTaskNode(missingParameters)).toBe(false);
    expect(isTaskNode(conflictingPayloads)).toBe(false);
  });

  it("defers GenerationParameters ranges but validates their storage shape", () => {
    const emptyParameters = createParametersNode("empty-parameters", {});
    const deferredSemantics = createParametersNode("parameters", {
      temperature: Number.NaN,
      maxOutputTokens: -1,
      stop: ["", "DONE"],
    });
    const stopGetter = vi.fn(() => {
      // Throw if shape validation reads a GenerationParameters accessor.
      throw new Error("stop getter must not run");
    });
    const accessorParameters = Object.defineProperty({}, "stop", {
      enumerable: true,
      get: stopGetter,
    });
    const invalidCases = [
      createParametersNode("parameters", { temperature: "0.7" }),
      createParametersNode("parameters", { maxOutputTokens: undefined }),
      createParametersNode("parameters", { stop: ["DONE", 1] }),
      createParametersNode("parameters", { stop: new Array<unknown>(1) }),
      createParametersNode("parameters", accessorParameters),
    ];

    // Numbers and dense string arrays establish the interface shape. Finite/range,
    // integer, and nonempty-stop rules belong to the later dedicated validator.
    expect(isTaskNode(emptyParameters)).toBe(true);
    expect(isTaskNode(deferredSemantics)).toBe(true);
    for (const candidate of invalidCases) {
      expect(isTaskNode(candidate)).toBe(false);
    }
    expect(stopGetter).not.toHaveBeenCalled();
  });

  it("validates optional raw preservation storage for unknown leaves", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const valid = {
      ...createUnknownLeaf("unknown", "vendor.binary"),
      raw: {
        mediaType: "application/octet-stream",
        schemaId: "vendor.binary.v1",
        bytes,
        truncated: false,
        metadata: { source: "response" },
      },
    };
    const revokedBytes = Proxy.revocable(new Uint8Array(), {});
    revokedBytes.revoke();

    // Raw bytes remain the exact view and no size, decoding, or copy policy is
    // applied. Incorrect, revoked, and non-portable storage fails locally.
    expect(isTaskNode(valid)).toBe(true);
    expect(valid.raw.bytes).toBe(bytes);
    expect(isTaskNode({ ...valid, raw: { ...valid.raw, bytes: [1, 2, 3] } })).toBe(false);
    expect(isTaskNode({ ...valid, raw: { ...valid.raw, bytes: revokedBytes.proxy } })).toBe(false);
    expect(isTaskNode({ ...valid, raw: { ...valid.raw, metadata: { invalid: undefined } } })).toBe(
      false,
    );
    expect(isTaskNode({ ...valid, raw: undefined })).toBe(false);
  });

  it("rejects sparse child collections and direct ID collisions", () => {
    const duplicate = createUnknownLeaf("duplicate");
    const sparseChildren = new Array<TaskNode>(1);

    // Dense ordered membership, parent/child separation, and sibling uniqueness
    // are decidable at the local edge without a full document traversal.
    expect(isTaskNode({ ...createGroup("root"), children: sparseChildren })).toBe(false);
    expect(isTaskNode(createGroup("same", [createUnknownLeaf("same")]))).toBe(false);
    expect(isTaskNode(createGroup("root", [duplicate, duplicate]))).toBe(false);
    expect(isTaskNode(createGroup("root", [{ id: "partial" } as TaskNode]))).toBe(false);
  });

  it("validates relations without resolving their endpoints", () => {
    const unresolved = createRelation("future-source", "future-target", "vendor.references");
    const base = createUnknownLeaf("node");

    // A syntactically complete unresolved edge passes locally; missing nodes and
    // self-reference policy require the full document index.
    expect(isTaskNode({ ...base, relations: [unresolved] })).toBe(true);
    expect(isTaskNode({ ...base, relations: [{ ...unresolved, sourceId: "" }] })).toBe(false);
    expect(isTaskNode({ ...base, relations: [{ ...unresolved, targetId: " \t" }] })).toBe(false);
    expect(isTaskNode({ ...base, relations: [{ ...unresolved, type: "vendor relation" }] })).toBe(
      false,
    );
    expect(
      isTaskNode({
        ...base,
        relations: [{ ...unresolved, metadata: { invalid: Number.POSITIVE_INFINITY } }],
      }),
    ).toBe(false);
  });

  it("rejects invalid relation collections and preservation maps", () => {
    const base = createUnknownLeaf("node");
    const relationArray = [createRelation("node", "other", "vendor.references")];
    const sparseRelations = new Array<TaskRelation>(1);

    // Ordered relations and both map channels require dense/portable storage;
    // coercible collections, host objects, and cyclic JSON remain invalid.
    expect(isTaskNode({ ...base, relations: sparseRelations })).toBe(false);
    expect(isTaskNode({ ...base, relations: new Set(relationArray) })).toBe(false);
    expect(isTaskNode({ ...base, metadata: [] })).toBe(false);
    expect(isTaskNode({ ...base, extensions: new Date() })).toBe(false);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(isTaskNode({ ...base, metadata: cyclic })).toBe(false);
  });

  it("does not recursively validate direct child payload semantics", () => {
    const invalidGrandchild = {
      ...createUnknownLeaf("grandchild"),
      metadata: { invalid: Number.NaN },
    };
    const childGroup = createGroup("child-group", [invalidGrandchild as TaskNode]);
    const parent = createGroup("root", [childGroup]);

    // Parent and child-group local surfaces pass because their immediate edges
    // are complete. The invalid descendant fails when document traversal visits
    // that value as the current node.
    expect(isTaskNode(parent)).toBe(true);
    expect(isTaskNode(childGroup)).toBe(true);
    expect(isTaskNode(invalidGrandchild)).toBe(false);
  });

  it("allows unknown top-level fields without consulting them", () => {
    const unknownGetter = vi.fn(() => {
      // Throw if validation starts interpreting application-owned state.
      throw new Error("unknown getter must not run");
    });
    const node = {
      ...createUnknownLeaf("node"),
      futureOption: { enabled: true },
      get applicationState(): never {
        // Route a forbidden read through the spy so execution is observable.
        return unknownGetter();
      },
    };

    // Structural openness preserves unknown fields while local control flow
    // depends only on the declared TaskNode surface.
    expect(isTaskNode(node)).toBe(true);
    expect(unknownGetter).not.toHaveBeenCalled();
    expect(node.futureOption).toEqual({ enabled: true });
  });

  it("contains Proxy failures and leaves valid input unchanged", () => {
    const nodeProxy = new Proxy(
      {},
      {
        ownKeys: () => {
          // Simulate a hostile record reflection boundary.
          throw new Error("node failure");
        },
      },
    );
    const revokedNode = Proxy.revocable({}, {});
    revokedNode.revoke();
    const node = createGroup("root", [createUnknownLeaf("child")]);
    const original = structuredClone(node);

    // Hostile inputs fail closed; valid data is never sorted, normalized, frozen,
    // copied into the caller, or otherwise mutated during validation.
    expect(isTaskNode(nodeProxy)).toBe(false);
    expect(isTaskNode(revokedNode.proxy)).toBe(false);
    expect(isTaskNode(node)).toBe(true);
    expect(node).toEqual(original);
  });

  it("exposes the intended local type-guard signature", () => {
    // Lock the public validator to a reusable unknown-input type predicate.
    expectTypeOf(isTaskNode).toEqualTypeOf<(value: unknown) => value is TaskNode>();
  });
});

/** Creates one open unknown leaf with explicit empty preservation channels. */
function createUnknownLeaf(id: string, kind = "vendor.input"): UnknownTaskNode {
  // Every shared field is present and no typed payload or child collection is
  // introduced, making this the neutral baseline for negative cases.
  return {
    id,
    kind,
    composition: "leaf",
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Creates one conversation input leaf retaining a complete MessageDocument. */
function createConversationNode(id: string, messages: MessageDocument): ConversationInputNode {
  // The fixed Kind and leaf composition select the typed payload without adding
  // parameter, raw, or container state.
  return {
    id,
    kind: "task.input.conversation",
    composition: "leaf",
    messages,
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Creates one generation-configuration leaf from dynamic test storage. */
function createParametersNode(id: string, parameters: object): GenerationParametersNode {
  // The cast deliberately permits malformed runtime fixtures while preserving a
  // valid outer node, so validator tests can isolate parameter storage checks.
  return {
    id,
    kind: "task.configuration",
    composition: "leaf",
    parameters: parameters as GenerationParametersNode["parameters"],
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Creates one ordered Task container with caller-owned child and relation arrays. */
function createGroup(
  id: string,
  children: readonly TaskNode[] = [],
  relations: readonly TaskRelation[] = [],
): TaskGroupNode {
  // Direct references are returned unchanged so tests can detect copying,
  // sorting, or implicit relation resolution.
  return {
    id,
    kind: "task.root",
    composition: "container",
    children,
    relations,
    metadata: {},
    extensions: {},
  };
}

/** Creates one local relation without requiring its endpoints to exist. */
function createRelation(sourceId: string, targetId: string, type: string): TaskRelation {
  // Endpoint strings and open type stay independent; empty metadata keeps the
  // fixture focused on relation identity and collection behavior.
  return {
    sourceId,
    targetId,
    type,
    metadata: {},
  };
}

/** Creates the smallest complete conversation MessageDocument. */
function createMessageDocument(): MessageDocument {
  // The independent Message tree has a valid root and no Task, Artifact, model,
  // access, or protocol data mixed into its payload.
  return {
    version: "1.0",
    purpose: "input",
    root: {
      id: "message-root",
      kind: "message.root",
      composition: "container",
      children: [],
      relations: [],
      metadata: {},
      extensions: {},
    },
    metadata: {},
    extensions: {},
  };
}
