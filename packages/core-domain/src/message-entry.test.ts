// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { MessageContent } from "./message-content.js";
import type { MessageEntry } from "./message-entry.js";
import type { MessageRelation } from "./message-relation.js";
import type { MessageRole } from "./message-role.js";

it("defines exactly one immutable leaf entry shape", () => {
  // Exact equality proves the inherited base adds only reviewed common fields
  // and that children, task, access, model, and protocol fields remain absent.
  expectTypeOf<MessageEntry>().toEqualTypeOf<{
    readonly id: string;
    readonly kind: "message.entry";
    readonly role: MessageRole;
    readonly content: readonly MessageContent[];
    readonly relations: readonly MessageRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>();
});

it("preserves role and heterogeneous content order by identity", () => {
  const role: MessageRole = { id: "message.user", extensions: {} };
  const first: MessageContent = {
    id: "content-1",
    kind: "content.text",
    text: "Question",
    metadata: {},
    extensions: {},
  };
  const second: MessageContent = {
    id: "content-2",
    kind: "provider.content.citation",
    metadata: {},
    extensions: {},
  };
  const entry: MessageEntry = {
    id: "message-1",
    kind: "message.entry",
    role,
    content: [first, second],
    relations: [],
    metadata: {},
    extensions: {},
  };

  // Entry construction does not copy, group, reorder, or reinterpret its role
  // and content objects before protocol mapping.
  expect(entry.role).toBe(role);
  expect(entry.content.map(({ id }) => id)).toEqual(["content-1", "content-2"]);
  expect(entry.content[0]).toBe(first);
  expect(entry.content[1]).toBe(second);
});

it("represents empty content without inventing a child collection", () => {
  const entry: MessageEntry = {
    id: "message-empty",
    kind: "message.entry",
    role: { id: "message.assistant", extensions: {} },
    content: [],
    relations: [],
    metadata: {},
    extensions: {},
  };

  // Representation allows an explicit empty ordered collection. Acceptance of
  // empty entries belongs to the later validator, while children remain absent.
  expect(entry.content).toEqual([]);
  expect(Object.hasOwn(entry, "children")).toBe(false);
});

it("requires role content and the exact entry discriminator", () => {
  // Missing entry-specific fields and a container kind are rejected separately
  // so later consumers can depend on the fixed leaf representation.
  expectTypeOf<{
    readonly id: string;
    readonly kind: "message.entry";
    readonly content: readonly MessageContent[];
    readonly relations: readonly MessageRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<MessageEntry>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: "message.group";
    readonly role: MessageRole;
    readonly content: readonly MessageContent[];
    readonly relations: readonly MessageRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<MessageEntry>();
});

it("prevents entry-specific and inherited collection mutation", () => {
  const proveReadonly = (entry: MessageEntry, content: MessageContent): void => {
    // Exercise representative forbidden writes only during compilation; this
    // helper is retained below but never invoked at runtime.
    // @ts-expect-error Entry kind is fixed and readonly.
    entry.kind = "message.group";
    // @ts-expect-error Role reference cannot be replaced.
    entry.role = { id: "message.system", extensions: {} };
    // @ts-expect-error Content collection cannot be replaced.
    entry.content = [];
    // @ts-expect-error Readonly content cannot be appended.
    entry.content.push(content);
    // @ts-expect-error Inherited relations cannot be mutated.
    entry.relations.pop();
    // @ts-expect-error Inherited metadata entries remain readonly.
    entry.metadata.status = "changed";
  };

  // Keep the helper reachable so strict TypeScript checking validates every
  // forbidden assignment without executing a runtime mutation.
  expectTypeOf(proveReadonly).toBeFunction();
});
