// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { OpenIdentifier } from "./open-identifier.js";
import type { TaskGroupNode } from "./task-group-node.js";
import type { TaskNodeBase } from "./task-node-base.js";
import type { TaskRelation } from "./task-relation.js";

it("extends only the shared Task-node fields with container structure", () => {
  // Exact equality prevents task-specific payloads, Message data, Artifact data,
  // protocol state, or execution behavior from entering the group abstraction.
  expectTypeOf<TaskGroupNode>().toEqualTypeOf<{
    readonly id: string;
    readonly kind: "task.root" | "task.group" | (OpenIdentifier & Record<never, never>);
    readonly relations: readonly TaskRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
    readonly composition: "container";
    readonly children: readonly TaskNodeBase[];
  }>();
});

it("preserves declared child order and object identity", () => {
  const firstChild = createBaseChild("task-input", "task.input");
  const secondChild = createBaseChild("task-configuration", "task.configuration");
  const group: TaskGroupNode = {
    id: "task-root",
    kind: "task.root",
    composition: "container",
    children: [firstChild, secondChild],
    relations: [],
    metadata: {},
    extensions: {},
  };

  // Array position is the Task-document order. Construction performs no sort,
  // traversal, cloning, or conversion of the caller's child objects.
  expect(group.children.map(readTaskNodeId)).toEqual(["task-input", "task-configuration"]);
  expect(group.children[0]).toBe(firstChild);
  expect(group.children[1]).toBe(secondChild);
});

it("supports the nested standard group and integration-defined kinds", () => {
  const nestedGroup: TaskGroupNode = {
    id: "task-context",
    kind: "task.group",
    composition: "container",
    children: [],
    relations: [],
    metadata: {},
    extensions: {},
  };
  const customGroup: TaskGroupNode = {
    id: "task-provider-batch",
    kind: "provider.task.batch_group",
    composition: "container",
    children: [nestedGroup],
    relations: [],
    metadata: { label: "批处理" },
    extensions: {},
  };

  // Both standard and custom identities use the same immutable container shape;
  // Core does not infer behavior or support from the open kind string.
  expect(nestedGroup.kind).toBe("task.group");
  expect(customGroup.kind).toBe("provider.task.batch_group");
  expect(customGroup.children[0]).toBe(nestedGroup);
});

it("requires container composition and an explicit child collection", () => {
  // Each structural field remains mandatory so a concrete leaf or an omitted
  // collection cannot be treated as a group through defaults.
  expectTypeOf<{
    readonly id: string;
    readonly kind: "task.root";
    readonly children: readonly TaskNodeBase[];
    readonly relations: readonly TaskRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<TaskGroupNode>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: "task.root";
    readonly composition: "container";
    readonly relations: readonly TaskRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<TaskGroupNode>();
});

it("prevents structure replacement and child collection mutation", () => {
  const proveReadonly = (group: TaskGroupNode, child: TaskNodeBase): void => {
    // Compile representative invalid writes while keeping this helper unreachable
    // from runtime tests and unable to mutate constructed values.
    // @ts-expect-error Group identity cannot be replaced.
    group.kind = "task.group";
    // @ts-expect-error Container composition cannot be replaced with a leaf.
    group.composition = "leaf";
    // @ts-expect-error The child collection cannot be replaced.
    group.children = [];
    // @ts-expect-error The readonly child collection cannot be appended.
    group.children.push(child);
  };

  // Retain the helper so strict TypeScript checks all readonly constraints
  // without executing its intentionally invalid assignments.
  expectTypeOf(proveReadonly).toBeFunction();
});

/** Creates one minimal package-internal child shape for group ordering tests. */
function createBaseChild(id: string, kind: OpenIdentifier): TaskNodeBase {
  // Every required base field is explicit; the helper adds no composition,
  // payload, validation, or behavior belonging to later concrete node types.
  return {
    id,
    kind,
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Returns one stable child ID without altering group collection order. */
function readTaskNodeId(node: TaskNodeBase): string {
  // Identity is observed exactly as supplied and is neither normalized nor
  // resolved against a TaskDocument at this type-contract boundary.
  return node.id;
}
