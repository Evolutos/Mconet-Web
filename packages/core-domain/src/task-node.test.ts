// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { TaskGroupNode } from "./task-group-node.js";
import type { TaskNode } from "./task-node.js";
import type { UnknownTaskNode } from "./unknown-task-node.js";

it("contains exactly the currently defined Task-node variants", () => {
  // Exact equality prevents Message elements, raw TaskNodeBase values, Artifacts,
  // requests, protocol payloads, or runtime components from entering the union.
  expectTypeOf<TaskNode>().toEqualTypeOf<TaskGroupNode | UnknownTaskNode>();
});

it("narrows container and leaf variants by composition", () => {
  const group = createGroup("task-root", []);
  const unknown = createUnknownLeaf("task-options", "provider.task.options");

  // The same helper exercises runtime output and compile-time branch narrowing
  // without casts, validators, or inspection of integration-defined kind values.
  expect(summarizeNode(group)).toBe("container:task-root:0");
  expect(summarizeNode(unknown)).toBe("leaf:task-options:provider.task.options");
});

it("supports recursively ordered heterogeneous Task trees", () => {
  const firstLeaf = createUnknownLeaf("task-input", "task.input");
  const nestedLeaf = createUnknownLeaf("task-constraint", "task.constraint");
  const nestedGroup = createGroup("task-context", [nestedLeaf]);
  const lastLeaf = createUnknownLeaf("task-output", "task.output_contract");
  const root = createGroup("task-root", [firstLeaf, nestedGroup, lastLeaf]);

  // Recursive children use the union itself, preserving heterogeneous order and
  // original object identity without flattening, sorting, or copying nodes.
  expect(root.children.map(readTaskNodeId)).toEqual(["task-input", "task-context", "task-output"]);
  expect(root.children[0]).toBe(firstLeaf);
  expect(root.children[1]).toBe(nestedGroup);
  expect(nestedGroup.children[0]).toBe(nestedLeaf);
  expect(root.children[2]).toBe(lastLeaf);
});

it("rejects values outside both Task-node variants", () => {
  // Primitives, shared-base-only objects, and Message-shaped values cannot
  // satisfy either the container or unknown-leaf structural contract.
  expectTypeOf<string>().not.toMatchTypeOf<TaskNode>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: "task.input";
    readonly relations: readonly [];
    readonly metadata: Readonly<Record<string, never>>;
    readonly extensions: Readonly<Record<string, never>>;
  }>().not.toMatchTypeOf<TaskNode>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: "message.entry";
    readonly role: { readonly id: "message.user" };
    readonly content: readonly [];
  }>().not.toMatchTypeOf<TaskNode>();
});

/** Creates one complete container using the recursive public TaskNode boundary. */
function createGroup(id: string, children: readonly TaskNode[]): TaskGroupNode {
  // Every shared and structural field is explicit; construction neither
  // validates descendants nor changes their order or identity.
  return {
    id,
    kind: id === "task-root" ? "task.root" : "task.group",
    composition: "container",
    children,
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Creates one unknown leaf for recursive-union and narrowing tests. */
function createUnknownLeaf(id: string, kind: string): UnknownTaskNode {
  // Omit raw data deliberately so the helper represents the smallest complete
  // preservation leaf and does not introduce byte handling into union tests.
  return {
    id,
    kind,
    composition: "leaf",
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Returns one stable node ID without changing recursive collection order. */
function readTaskNodeId(node: TaskNode): string {
  // Shared identity is directly available on both union members and is observed
  // without normalization or TaskDocument lookup.
  return node.id;
}

/** Produces a test-only summary after discriminating the TaskNode union. */
function summarizeNode(node: TaskNode): string {
  // Fixed composition values provide a sound structural discriminator even
  // though both variants intentionally accept open kind identifiers.
  if (node.composition === "container") {
    expectTypeOf(node).toEqualTypeOf<TaskGroupNode>();
    return `container:${node.id}:${node.children.length}`;
  }

  // The only current leaf member is UnknownTaskNode, retaining its open kind.
  expectTypeOf(node).toEqualTypeOf<UnknownTaskNode>();
  return `leaf:${node.id}:${node.kind}`;
}
