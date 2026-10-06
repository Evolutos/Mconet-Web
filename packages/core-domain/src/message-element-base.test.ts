// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { MessageElementBase } from "./message-element-base.js";
import type { MessageRelation } from "./message-relation.js";
import type { OpenIdentifier } from "./open-identifier.js";

it("defines only immutable fields shared by message-tree elements", () => {
  // Exact equality excludes TaskNode inheritance, generic children/content,
  // protocol state, access data, and executable tree behavior from the base.
  expectTypeOf<MessageElementBase>().toEqualTypeOf<{
    readonly id: string;
    readonly kind: OpenIdentifier;
    readonly relations: readonly MessageRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>();
});

it("preserves open element identity and ordered ID relations", () => {
  const firstRelation: MessageRelation = {
    sourceId: "element-a",
    targetId: "element-b",
    type: "message.precedes",
    metadata: {},
  };
  const secondRelation: MessageRelation = {
    sourceId: "element-a",
    targetId: "element-c",
    type: "provider.message.annotates",
    metadata: {},
  };
  const element: MessageElementBase = {
    id: "element-a",
    kind: "provider.message.review_group",
    relations: [firstRelation, secondRelation],
    metadata: {},
    extensions: {},
  };

  // Open kind and relation order remain caller-owned data. The base does not
  // resolve IDs, sort edges, or replace relation objects.
  expect(element.kind).toBe("provider.message.review_group");
  expect(element.relations.map(({ targetId }) => targetId)).toEqual(["element-b", "element-c"]);
  expect(element.relations[0]).toBe(firstRelation);
  expect(element.relations[1]).toBe(secondRelation);
});

it("keeps metadata and extensions separate from element structure", () => {
  const element: MessageElementBase = {
    id: "element-metadata",
    kind: "message.bundle",
    relations: [],
    metadata: {
      visible: true,
      rank: 3,
    },
    extensions: {
      "provider.message": {
        layout: "stacked",
      },
    },
  };

  // Application metadata and integration extensions are preserved in separate
  // maps and never promoted into kind, relation, child, or content semantics.
  expect(element.metadata).toEqual({ visible: true, rank: 3 });
  expect(element.extensions).toEqual({
    "provider.message": {
      layout: "stacked",
    },
  });
});

it("requires every shared message-element field at compile time", () => {
  // Representative omissions prove identity, classification, relations, and
  // both JSON maps are explicit rather than inferred by concrete elements.
  expectTypeOf<{
    readonly kind: OpenIdentifier;
    readonly relations: readonly MessageRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<MessageElementBase>();
  expectTypeOf<{
    readonly id: string;
    readonly relations: readonly MessageRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<MessageElementBase>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: OpenIdentifier;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<MessageElementBase>();
});

it("prevents replacement and collection mutation at compile time", () => {
  const proveReadonly = (element: MessageElementBase, relation: MessageRelation): void => {
    // Exercise representative top-level and nested writes only during
    // compilation; this helper is retained below but never invoked at runtime.
    // @ts-expect-error Element identity cannot be replaced.
    element.id = "element-changed";
    // @ts-expect-error Element classification cannot be replaced.
    element.kind = "message.changed";
    // @ts-expect-error The relation collection cannot be replaced.
    element.relations = [];
    // @ts-expect-error The readonly relation collection cannot be appended.
    element.relations.push(relation);
    // @ts-expect-error Metadata entries remain readonly.
    element.metadata.status = "changed";
    // @ts-expect-error Extension entries remain readonly.
    element.extensions["provider.message"] = null;
  };

  // Keep the helper reachable so strict TypeScript checking validates every
  // forbidden assignment without executing a runtime mutation.
  expectTypeOf(proveReadonly).toBeFunction();
});
