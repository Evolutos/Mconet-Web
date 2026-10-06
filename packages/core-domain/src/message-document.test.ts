// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { MessageDocument } from "./message-document.js";
import type { MessageEntry } from "./message-entry.js";
import type { MessageGroup } from "./message-group.js";
import type { OpenIdentifier } from "./open-identifier.js";

it("defines only the immutable neutral message-document envelope", () => {
  // Exact equality prevents Task, target, access, authorization, protocol, and
  // runtime execution fields from entering the Message-domain root contract.
  expectTypeOf<MessageDocument>().toEqualTypeOf<{
    readonly version: string;
    readonly purpose: "input" | "output" | "context" | (OpenIdentifier & Record<never, never>);
    readonly root: MessageGroup;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>();
});

it("expresses every standard document purpose", () => {
  const root = createRoot();
  const documents: readonly MessageDocument[] = [
    createDocument("input", root),
    createDocument("output", root),
    createDocument("context", root),
  ];

  // Preserve the standard vocabulary and shared root identity without assigning
  // protocol-specific behavior to a purpose value.
  expect(documents.map(({ purpose }) => purpose)).toEqual(["input", "output", "context"]);
  expect(documents.every((document) => document.root === root)).toBe(true);
});

it("preserves integration-defined purpose metadata and extensions", () => {
  const document: MessageDocument = {
    version: "1.0",
    purpose: "provider.review_context",
    root: createRoot(),
    metadata: {
      locale: "zh-CN",
      reviewed: false,
    },
    extensions: {
      "provider.document": {
        audience: "internal",
      },
    },
  };

  // Open purpose and both JSON maps remain neutral data; Core does not promote
  // provider values to routing or execution decisions.
  expect(document.purpose).toBe("provider.review_context");
  expect(document.metadata).toEqual({ locale: "zh-CN", reviewed: false });
  expect(document.extensions).toEqual({
    "provider.document": {
      audience: "internal",
    },
  });
});

it("requires a MessageGroup root and every envelope field", () => {
  // A leaf entry cannot replace the root container, and missing version or JSON
  // maps cannot be inferred from surrounding task or protocol state.
  expectTypeOf<{
    readonly version: string;
    readonly purpose: "input";
    readonly root: MessageEntry;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<MessageDocument>();
  expectTypeOf<{
    readonly purpose: "input";
    readonly root: MessageGroup;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<MessageDocument>();
});

it("prevents envelope and nested map replacement", () => {
  const proveReadonly = (document: MessageDocument, root: MessageGroup): void => {
    // Exercise every representative write only during compilation; this helper
    // is retained below but never invoked at runtime.
    // @ts-expect-error Version cannot be replaced.
    document.version = "2.0";
    // @ts-expect-error Purpose cannot be replaced.
    document.purpose = "output";
    // @ts-expect-error Root reference cannot be replaced.
    document.root = root;
    // @ts-expect-error Metadata entries remain readonly.
    document.metadata.status = "changed";
    // @ts-expect-error Extension entries remain readonly.
    document.extensions["provider.document"] = null;
  };

  // Keep the helper reachable so strict TypeScript checking validates every
  // forbidden assignment without executing a runtime mutation.
  expectTypeOf(proveReadonly).toBeFunction();
});

/**
 * Creates the minimal root group required by a MessageDocument.
 *
 * @returns Empty root container with all required data fields.
 */
function createRoot(): MessageGroup {
  // Fill every required group field explicitly without depending on a later
  // builder or validator implementation.
  return {
    id: "message-root",
    kind: "message.root",
    composition: "container",
    children: [],
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/**
 * Creates a minimal document for one reviewed purpose.
 *
 * @param purpose Standard or integration-defined document purpose.
 * @param root Root container retained by identity.
 * @returns Complete neutral MessageDocument value.
 */
function createDocument(purpose: MessageDocument["purpose"], root: MessageGroup): MessageDocument {
  // Reuse the supplied root identity while allocating independent outer maps so
  // each document remains a separate representation value.
  return {
    version: "1.0",
    purpose,
    root,
    metadata: {},
    extensions: {},
  };
}
