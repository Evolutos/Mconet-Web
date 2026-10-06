// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ConversationInputNode } from "./conversation-input-node.js";
import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { MessageDocument } from "./message-document.js";
import type { TaskRelation } from "./task-relation.js";

it("defines only conversation input and shared Task-node fields", () => {
  // Exact equality excludes duplicated Message fields, Artifacts, generation
  // parameters, model selection, access, protocol data, and execution behavior.
  expectTypeOf<ConversationInputNode>().toEqualTypeOf<{
    readonly id: string;
    readonly kind: "task.input.conversation";
    readonly relations: readonly TaskRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
    readonly composition: "leaf";
    readonly messages: MessageDocument;
  }>();
});

it("retains the complete MessageDocument by identity", () => {
  const messages = createMessageDocument();
  const node: ConversationInputNode = {
    id: "task-conversation-input",
    kind: "task.input.conversation",
    composition: "leaf",
    messages,
    relations: [],
    metadata: {},
    extensions: {},
  };

  // The Task leaf neither flattens nor copies the Message tree; the domain
  // document remains the one payload reference owned by this concrete node.
  expect(node.messages).toBe(messages);
  expect(node.messages.root).toBe(messages.root);
  expect(node.kind).toBe("task.input.conversation");
});

it("keeps Task metadata separate from Message metadata", () => {
  const messages = createMessageDocument();
  const node: ConversationInputNode = {
    id: "task-conversation-input",
    kind: "task.input.conversation",
    composition: "leaf",
    messages,
    relations: [],
    metadata: {
      source: "normalized-request",
    },
    extensions: {
      "provider.task-input": {
        priority: 0,
      },
    },
  };

  // Task annotations remain outside the MessageDocument and cannot become a
  // role, content item, purpose, or Message metadata entry.
  expect(node.metadata).toEqual({ source: "normalized-request" });
  expect(node.extensions).toEqual({ "provider.task-input": { priority: 0 } });
  expect(messages.metadata).toEqual({ locale: "zh-CN" });
});

it("requires fixed leaf structure and the MessageDocument payload", () => {
  // Missing messages or container composition cannot satisfy the concrete leaf;
  // no empty Message sentinel or default document is invented by the type.
  expectTypeOf<{
    readonly id: string;
    readonly kind: "task.input.conversation";
    readonly composition: "leaf";
    readonly relations: readonly TaskRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<ConversationInputNode>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: "task.input.conversation";
    readonly composition: "container";
    readonly messages: MessageDocument;
    readonly relations: readonly TaskRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<ConversationInputNode>();
});

it("prevents conversation leaf and Message reference replacement", () => {
  const proveReadonly = (node: ConversationInputNode, messages: MessageDocument): void => {
    // Compile representative invalid writes while keeping this helper
    // unreachable from runtime tests and unable to mutate domain values.
    // @ts-expect-error Fixed conversation kind cannot be replaced.
    node.kind = "task.input.other";
    // @ts-expect-error Leaf composition cannot be replaced with a container.
    node.composition = "container";
    // @ts-expect-error MessageDocument reference cannot be replaced.
    node.messages = messages;
    // @ts-expect-error Inherited identity cannot be replaced.
    node.id = "task-changed";
    // @ts-expect-error Inherited metadata entries remain readonly.
    node.metadata.status = "changed";
  };

  // Retain the helper so strict TypeScript validates every readonly constraint
  // without executing its intentionally invalid assignments.
  expectTypeOf(proveReadonly).toBeFunction();
});

/** Creates one complete empty MessageDocument for Task payload identity tests. */
function createMessageDocument(): MessageDocument {
  // Build the neutral Message envelope explicitly without a builder, Task data,
  // protocol mapping, or validation side effect.
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
    metadata: {
      locale: "zh-CN",
    },
    extensions: {},
  };
}
