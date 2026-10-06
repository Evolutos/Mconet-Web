// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { JsonValue } from "./json-value.js";
import type { OpenIdentifier } from "./open-identifier.js";
import type { TaskRelation } from "./task-relation.js";

it("defines only immutable directed task-node ID references", () => {
  // Exact equality prevents embedded nodes, message-domain inheritance,
  // traversal callbacks, extensions, or executable behavior from entering it.
  expectTypeOf<TaskRelation>().toEqualTypeOf<{
    readonly sourceId: string;
    readonly targetId: string;
    readonly type: OpenIdentifier;
    readonly metadata: Readonly<Record<string, JsonValue>>;
  }>();
});

it("keeps source and target direction explicit", () => {
  const relation: TaskRelation = {
    sourceId: "task-input",
    targetId: "task-result",
    type: "task.produces",
    metadata: {},
  };

  // Different endpoint values demonstrate a directed edge between stable IDs,
  // not an unordered pair, array-position inference, or embedded TaskNodes.
  expect(relation.sourceId).toBe("task-input");
  expect(relation.targetId).toBe("task-result");
  expect(relation.sourceId).not.toBe(relation.targetId);
});

it("preserves an integration-defined relation type and JSON metadata", () => {
  const relation: TaskRelation = {
    sourceId: "task-draft",
    targetId: "task-review",
    type: "provider.task.requires_review",
    metadata: {
      priority: 0,
      blocking: false,
      labels: ["automatic", "多语言"],
    },
  };

  // Core retains provider meaning and explicit false, zero, array, and Unicode
  // values without promoting metadata keys into task execution control flow.
  expect(relation).toEqual({
    sourceId: "task-draft",
    targetId: "task-review",
    type: "provider.task.requires_review",
    metadata: {
      priority: 0,
      blocking: false,
      labels: ["automatic", "多语言"],
    },
  });
});

it("represents a self-relation without imposing graph policy", () => {
  const relation: TaskRelation = {
    sourceId: "task-iterative",
    targetId: "task-iterative",
    type: "task.iterates",
    metadata: {},
  };

  // Representation preserves the supplied edge exactly. Cycle and endpoint
  // policy belong to the later TaskDocument validator, not this value interface.
  expect(relation.sourceId).toBe(relation.targetId);
});

it("requires both endpoints type and metadata at compile time", () => {
  // Check every omission independently so no endpoint, classification, or map
  // can be inferred from a containing node or silently defaulted.
  expectTypeOf<{
    readonly targetId: string;
    readonly type: OpenIdentifier;
    readonly metadata: Readonly<Record<string, JsonValue>>;
  }>().not.toMatchTypeOf<TaskRelation>();
  expectTypeOf<{
    readonly sourceId: string;
    readonly type: OpenIdentifier;
    readonly metadata: Readonly<Record<string, JsonValue>>;
  }>().not.toMatchTypeOf<TaskRelation>();
  expectTypeOf<{
    readonly sourceId: string;
    readonly targetId: string;
    readonly metadata: Readonly<Record<string, JsonValue>>;
  }>().not.toMatchTypeOf<TaskRelation>();
  expectTypeOf<{
    readonly sourceId: string;
    readonly targetId: string;
    readonly type: OpenIdentifier;
  }>().not.toMatchTypeOf<TaskRelation>();
});

it("prevents endpoint type and metadata replacement", () => {
  const proveReadonly = (relation: TaskRelation): void => {
    // Compile every representative forbidden write while keeping this helper
    // unreachable from runtime tests.
    // @ts-expect-error Source task-node identity cannot be replaced.
    relation.sourceId = "task-changed-source";
    // @ts-expect-error Target task-node identity cannot be replaced.
    relation.targetId = "task-changed-target";
    // @ts-expect-error Task relationship classification cannot be replaced.
    relation.type = "task.changed";
    // @ts-expect-error The metadata map cannot be replaced.
    relation.metadata = {};
    // @ts-expect-error Individual metadata entries remain readonly.
    relation.metadata.status = "changed";
  };

  // Retain the helper so strict TypeScript validates all readonly constraints
  // without executing its intentionally invalid assignments.
  expectTypeOf(proveReadonly).toBeFunction();
});
