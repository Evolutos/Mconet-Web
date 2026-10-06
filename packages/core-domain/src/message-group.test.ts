// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { MessageEntry } from "./message-entry.js";
import type { MessageGroup } from "./message-group.js";
import type { MessageRelation } from "./message-relation.js";
import type { OpenIdentifier } from "./open-identifier.js";

it("defines exactly one immutable recursive container shape", () => {
  // Exact equality proves the group adds only container composition and ordered
  // element children, without content payloads, roles, or TaskNode fields.
  expectTypeOf<MessageGroup>().toEqualTypeOf<{
    readonly id: string;
    readonly kind: "message.root" | "message.group" | (OpenIdentifier & Record<never, never>);
    readonly composition: "container";
    readonly children: readonly (MessageGroup | MessageEntry)[];
    readonly relations: readonly MessageRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>();
});

it("preserves nested group and entry order by identity", () => {
  const nested: MessageGroup = createGroup("group-history", "message.history", []);
  const entry: MessageEntry = {
    id: "message-current",
    kind: "message.entry",
    role: { id: "message.user", extensions: {} },
    content: [],
    relations: [],
    metadata: {},
    extensions: {},
  };
  const root = createGroup("message-root", "message.root", [nested, entry]);

  // Container construction does not flatten, sort, clone, or reinterpret child
  // elements; traversal can therefore rely on stable caller order.
  expect(root.children.map(({ id }) => id)).toEqual(["group-history", "message-current"]);
  expect(root.children[0]).toBe(nested);
  expect(root.children[1]).toBe(entry);
});

it("preserves integration-defined group kinds", () => {
  const group = createGroup("group-review", "provider.message.review_bundle", []);

  // Open classification allows new grouping semantics without adding protocol
  // fields or modifying core-domain, while composition remains a container.
  expect(group.kind).toBe("provider.message.review_bundle");
  expect(group.composition).toBe("container");
});

it("represents an empty container without null or placeholder children", () => {
  const group = createGroup("group-empty", "message.group", []);

  // Empty groups remain explicit ordered collections. A later validator decides
  // whether a particular document location permits them.
  expect(group.children).toEqual([]);
  expect(Array.isArray(group.children)).toBe(true);
});

it("rejects leaf composition and direct content children at compile time", () => {
  // Group composition is fixed, and MessageContent values cannot bypass Entry
  // ownership to become tree children.
  expectTypeOf<{
    readonly id: string;
    readonly kind: "message.group";
    readonly composition: "leaf";
    readonly children: readonly MessageEntry[];
    readonly relations: readonly MessageRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<MessageGroup>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: "message.group";
    readonly composition: "container";
    readonly children: readonly [{ readonly kind: "content.text"; readonly text: string }];
    readonly relations: readonly MessageRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<MessageGroup>();
});

it("prevents group and child collection mutation", () => {
  const proveReadonly = (group: MessageGroup, child: MessageEntry): void => {
    // Exercise container-specific and inherited writes only during compilation;
    // this helper is retained below but never invoked at runtime.
    // @ts-expect-error Group kind cannot be replaced.
    group.kind = "message.changed";
    // @ts-expect-error Container composition is fixed and readonly.
    group.composition = "container";
    // @ts-expect-error Child collection cannot be replaced.
    group.children = [];
    // @ts-expect-error Readonly children cannot be appended.
    group.children.push(child);
    // @ts-expect-error Inherited relations cannot be mutated.
    group.relations.pop();
    // @ts-expect-error Inherited extension entries remain readonly.
    group.extensions["provider.message"] = null;
  };

  // Keep the helper reachable so strict TypeScript checking validates every
  // forbidden assignment without executing a runtime mutation.
  expectTypeOf(proveReadonly).toBeFunction();
});

/**
 * Creates a minimal immutable-by-contract group for focused type tests.
 *
 * @param id Stable group identity.
 * @param kind Open container classification.
 * @param children Ordered nested groups and entries.
 * @returns Message group with empty relations and JSON maps.
 */
function createGroup(
  id: string,
  kind: MessageGroup["kind"],
  children: MessageGroup["children"],
): MessageGroup {
  // Populate every required field explicitly so tests never rely on builders or
  // runtime defaults that belong to later implementation steps.
  return {
    id,
    kind,
    composition: "container",
    children,
    relations: [],
    metadata: {},
    extensions: {},
  };
}
