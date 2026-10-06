// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { TaskDocument } from "./task-document.js";
import type { TaskGroupNode } from "./task-group-node.js";
import type { UnknownTaskNode } from "./unknown-task-node.js";

it("defines only the immutable neutral Task-document envelope", () => {
  // Exact equality prevents Message roots, Artifacts, targets, access, protocol,
  // validation state, or runtime execution behavior from entering the document.
  expectTypeOf<TaskDocument>().toEqualTypeOf<{
    readonly version: string;
    readonly root: TaskGroupNode;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>();
});

it("preserves opaque version root identity and ordered descendants", () => {
  const child = createUnknownLeaf("task-input", "task.input");
  const root = createRoot([child]);
  const document: TaskDocument = {
    version: "provider-task-schema-v1",
    root,
    metadata: {},
    extensions: {},
  };

  // The envelope retains the version string and exact root/tree objects without
  // parsing, cloning, sorting, traversing, or validating their identities.
  expect(document.version).toBe("provider-task-schema-v1");
  expect(document.root).toBe(root);
  expect(document.root.children[0]).toBe(child);
});

it("keeps metadata and extensions independent from tree structure", () => {
  const document: TaskDocument = {
    version: "1.0",
    root: createRoot([]),
    metadata: {
      locale: "zh-CN",
      reviewed: false,
      attempt: 0,
    },
    extensions: {
      "provider.task-document": {
        audience: "internal",
      },
    },
  };

  // Both JSON maps preserve explicit false, zero, Unicode, and namespaced data
  // without promoting them into version, root, child, or execution semantics.
  expect(document.metadata).toEqual({ locale: "zh-CN", reviewed: false, attempt: 0 });
  expect(document.extensions).toEqual({
    "provider.task-document": {
      audience: "internal",
    },
  });
});

it("requires a TaskGroupNode root and every envelope field", () => {
  // An unknown leaf cannot replace the root container, and missing version or
  // either JSON map cannot be inferred from a request or protocol context.
  expectTypeOf<{
    readonly version: string;
    readonly root: UnknownTaskNode;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<TaskDocument>();
  expectTypeOf<{
    readonly root: TaskGroupNode;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<TaskDocument>();
  expectTypeOf<{
    readonly version: string;
    readonly root: TaskGroupNode;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<TaskDocument>();
});

it("prevents envelope and nested map replacement", () => {
  const proveReadonly = (document: TaskDocument, root: TaskGroupNode): void => {
    // Compile representative forbidden writes while keeping this helper
    // unreachable from runtime tests and unable to mutate Task data.
    // @ts-expect-error Version cannot be replaced.
    document.version = "2.0";
    // @ts-expect-error Root reference cannot be replaced.
    document.root = root;
    // @ts-expect-error Metadata container cannot be replaced.
    document.metadata = {};
    // @ts-expect-error Metadata entries remain readonly.
    document.metadata.status = "changed";
    // @ts-expect-error Extension container cannot be replaced.
    document.extensions = {};
    // @ts-expect-error Extension entries remain readonly.
    document.extensions["provider.task-document"] = null;
  };

  // Retain the helper so strict TypeScript validates every readonly constraint
  // without executing its intentionally invalid assignments.
  expectTypeOf(proveReadonly).toBeFunction();
});

/** Creates one complete root container around caller-selected ordered children. */
function createRoot(children: TaskGroupNode["children"]): TaskGroupNode {
  // Every required field is explicit; this constructor adds no builder defaults,
  // root-kind validation, traversal, or TaskDocument behavior.
  return {
    id: "task-root",
    kind: "task.root",
    composition: "container",
    children,
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Creates one minimal unknown leaf for root-order and root-type tests. */
function createUnknownLeaf(id: string, kind: string): UnknownTaskNode {
  // Omit optional raw data while making all shared and structural leaf fields
  // explicit; no typed Task payload or execution behavior is introduced.
  return {
    id,
    kind,
    composition: "leaf",
    relations: [],
    metadata: {},
    extensions: {},
  };
}
