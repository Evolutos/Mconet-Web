// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { OpenIdentifier } from "./open-identifier.js";
import type { TaskNodeBase } from "./task-node-base.js";
import type { TaskRelation } from "./task-relation.js";

it("defines only immutable fields shared by Task nodes", () => {
  // Exact equality excludes MessageElement inheritance, composition, children,
  // concrete payloads, protocol state, access data, and executable behavior.
  expectTypeOf<TaskNodeBase>().toEqualTypeOf<{
    readonly id: string;
    readonly kind: OpenIdentifier;
    readonly relations: readonly TaskRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>();
});

it("preserves open Task identity and ordered ID relations", () => {
  const firstRelation: TaskRelation = {
    sourceId: "task-input",
    targetId: "task-configuration",
    type: "task.precedes",
    metadata: {},
  };
  const secondRelation: TaskRelation = {
    sourceId: "task-input",
    targetId: "task-output-contract",
    type: "provider.task.constrains",
    metadata: {},
  };
  const node: TaskNodeBase = {
    id: "task-input",
    kind: "provider.task.composite_input",
    relations: [firstRelation, secondRelation],
    metadata: {},
    extensions: {},
  };

  // Open kind and relation order remain caller-owned data. The base performs no
  // endpoint resolution, sorting, copying, or relation-object replacement.
  expect(node.kind).toBe("provider.task.composite_input");
  expect(node.relations.map(readTaskRelationTargetId)).toEqual([
    "task-configuration",
    "task-output-contract",
  ]);
  expect(node.relations[0]).toBe(firstRelation);
  expect(node.relations[1]).toBe(secondRelation);
});

it("keeps metadata and extensions separate from Task-node structure", () => {
  const node: TaskNodeBase = {
    id: "task-metadata",
    kind: "task.context",
    relations: [],
    metadata: {
      visible: true,
      rank: 3,
    },
    extensions: {
      "provider.task": {
        layout: "stacked",
      },
    },
  };

  // Application metadata and integration extensions remain separate maps and
  // cannot become kind, composition, child, payload, or execution semantics.
  expect(node.metadata).toEqual({ visible: true, rank: 3 });
  expect(node.extensions).toEqual({
    "provider.task": {
      layout: "stacked",
    },
  });
});

it("requires every shared Task-node field at compile time", () => {
  // Representative omissions prove identity, classification, relations, and
  // both JSON maps remain explicit requirements for every concrete Task node.
  expectTypeOf<{
    readonly kind: OpenIdentifier;
    readonly relations: readonly TaskRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<TaskNodeBase>();
  expectTypeOf<{
    readonly id: string;
    readonly relations: readonly TaskRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<TaskNodeBase>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: OpenIdentifier;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<TaskNodeBase>();
});

it("prevents shared field replacement and relation collection mutation", () => {
  const proveReadonly = (node: TaskNodeBase, relation: TaskRelation): void => {
    // Compile representative invalid writes while keeping this helper unreachable
    // from runtime tests and therefore unable to mutate Fixture data.
    // @ts-expect-error Task-node identity cannot be replaced.
    node.id = "task-changed";
    // @ts-expect-error Task-node classification cannot be replaced.
    node.kind = "task.changed";
    // @ts-expect-error The relation collection cannot be replaced.
    node.relations = [];
    // @ts-expect-error The readonly relation collection cannot be appended.
    node.relations.push(relation);
    // @ts-expect-error Metadata entries remain readonly.
    node.metadata.status = "changed";
    // @ts-expect-error Extension entries remain readonly.
    node.extensions["provider.task"] = null;
  };

  // Retain the helper so strict TypeScript verifies all readonly constraints
  // without executing its intentionally invalid assignments.
  expectTypeOf(proveReadonly).toBeFunction();
});

/** Returns one stable relation target for the ordered collection assertion. */
function readTaskRelationTargetId(relation: TaskRelation): string {
  // The base observes exact relation order and identity without resolving or
  // normalizing the target reference.
  return relation.targetId;
}
