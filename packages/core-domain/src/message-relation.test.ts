// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { JsonValue } from "./json-value.js";
import type { MessageRelation } from "./message-relation.js";
import type { OpenIdentifier } from "./open-identifier.js";

it("defines only immutable directed ID-reference semantics", () => {
  // Exact equality prevents embedded elements, task nodes, traversal callbacks,
  // mutable extension bags, or executable relation behavior from entering it.
  expectTypeOf<MessageRelation>().toEqualTypeOf<{
    readonly sourceId: string;
    readonly targetId: string;
    readonly type: OpenIdentifier;
    readonly metadata: Readonly<Record<string, JsonValue>>;
  }>();
});

it("keeps source and target direction explicit", () => {
  const relation: MessageRelation = {
    sourceId: "message-question",
    targetId: "message-answer",
    type: "message.reply_to",
    metadata: {},
  };

  // Different values prove the two endpoints are separate directed references
  // rather than an unordered pair or embedded element objects.
  expect(relation.sourceId).toBe("message-question");
  expect(relation.targetId).toBe("message-answer");
  expect(relation.sourceId).not.toBe(relation.targetId);
});

it("preserves integration-defined relation types and JSON metadata", () => {
  const relation: MessageRelation = {
    sourceId: "message-review",
    targetId: "message-draft",
    type: "provider.message.reviews",
    metadata: {
      confidence: 0.98,
      labels: ["automated", "non_blocking"],
      accepted: false,
    },
  };

  // Open identity and metadata remain data-only values; Core does not interpret
  // provider relation semantics or promote metadata keys to control flow.
  expect(relation.type).toBe("provider.message.reviews");
  expect(relation.metadata).toEqual({
    confidence: 0.98,
    labels: ["automated", "non_blocking"],
    accepted: false,
  });
});

it("represents a self-relation without imposing graph policy", () => {
  const relation: MessageRelation = {
    sourceId: "message-reflective",
    targetId: "message-reflective",
    type: "message.self_reference",
    metadata: {},
  };

  // Representation preserves the caller's references exactly. Cycle or graph
  // policy belongs to the later document validator, not this value interface.
  expect(relation.sourceId).toBe(relation.targetId);
});

it("requires both endpoints type and metadata at compile time", () => {
  // Each field omission is checked independently so direction or classification
  // cannot be inferred from array position, surrounding elements, or defaults.
  expectTypeOf<{
    readonly targetId: string;
    readonly type: OpenIdentifier;
    readonly metadata: Readonly<Record<string, JsonValue>>;
  }>().not.toMatchTypeOf<MessageRelation>();
  expectTypeOf<{
    readonly sourceId: string;
    readonly type: OpenIdentifier;
    readonly metadata: Readonly<Record<string, JsonValue>>;
  }>().not.toMatchTypeOf<MessageRelation>();
  expectTypeOf<{
    readonly sourceId: string;
    readonly targetId: string;
    readonly metadata: Readonly<Record<string, JsonValue>>;
  }>().not.toMatchTypeOf<MessageRelation>();
  expectTypeOf<{
    readonly sourceId: string;
    readonly targetId: string;
    readonly type: OpenIdentifier;
  }>().not.toMatchTypeOf<MessageRelation>();
});

it("prevents endpoint type and metadata replacement", () => {
  const proveReadonly = (relation: MessageRelation): void => {
    // Exercise every forbidden write only during compilation; this helper is
    // retained below but never invoked at runtime.
    // @ts-expect-error Source identity cannot be replaced.
    relation.sourceId = "message-changed-source";
    // @ts-expect-error Target identity cannot be replaced.
    relation.targetId = "message-changed-target";
    // @ts-expect-error Relation classification cannot be replaced.
    relation.type = "message.changed";
    // @ts-expect-error The metadata map cannot be replaced.
    relation.metadata = {};
    // @ts-expect-error Individual metadata entries remain readonly.
    relation.metadata.status = "changed";
  };

  // Keep the helper reachable so strict TypeScript checking validates every
  // forbidden assignment without executing a runtime mutation.
  expectTypeOf(proveReadonly).toBeFunction();
});
