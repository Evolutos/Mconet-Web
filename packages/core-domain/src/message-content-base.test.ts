// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { MessageContentBase } from "./message-content-base.js";
import type { MessageContentKind } from "./message-content-kind.js";

it("defines only the immutable fields shared by message content", () => {
  // Exact equality excludes message-tree, task, access, transport, role, and
  // executable fields from this package-internal structural base.
  expectTypeOf<MessageContentBase>().toEqualTypeOf<{
    readonly id: string;
    readonly kind: MessageContentKind;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>();
});

it("represents standard and integration-defined content identities", () => {
  const standard: MessageContentBase = {
    id: "content-1",
    kind: "content.text",
    metadata: {},
    extensions: {},
  };
  const integrationDefined: MessageContentBase = {
    id: "content-2",
    kind: "provider.content.citation",
    metadata: {
      confidence: 0.9,
      labels: ["reviewed"],
    },
    extensions: {
      "provider.citation": {
        sourceCount: 2,
      },
    },
  };

  // Base data preserves open kind identity and JSON values without attaching a
  // concrete payload field or interpreting application metadata.
  expect(standard.kind).toBe("content.text");
  expect(integrationDefined).toEqual({
    id: "content-2",
    kind: "provider.content.citation",
    metadata: {
      confidence: 0.9,
      labels: ["reviewed"],
    },
    extensions: {
      "provider.citation": {
        sourceCount: 2,
      },
    },
  });
});

it("requires every shared content field at compile time", () => {
  // Each omission is checked independently so later variants cannot treat base
  // identity, classification, metadata, or extensions as implicit defaults.
  expectTypeOf<{
    readonly kind: MessageContentKind;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<MessageContentBase>();
  expectTypeOf<{
    readonly id: string;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<MessageContentBase>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: MessageContentKind;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<MessageContentBase>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: MessageContentKind;
    readonly metadata: Readonly<Record<string, JsonValue>>;
  }>().not.toMatchTypeOf<MessageContentBase>();
});

it("prevents replacement of base fields and nested map entries", () => {
  const proveReadonly = (content: MessageContentBase): void => {
    // Exercise all forbidden writes only during compilation; this helper is
    // retained below but never invoked at runtime.
    // @ts-expect-error Content identity cannot be replaced.
    content.id = "content-changed";
    // @ts-expect-error Content classification cannot be replaced.
    content.kind = "content.unknown";
    // @ts-expect-error The metadata map cannot be replaced.
    content.metadata = {};
    // @ts-expect-error Individual metadata entries are readonly.
    content.metadata.status = "changed";
    // @ts-expect-error The extension map cannot be replaced.
    content.extensions = {};
    // @ts-expect-error Individual extension entries are readonly.
    content.extensions["provider.content"] = null;
  };

  // Retain the helper in the program so strict TypeScript checking validates
  // every assignment without executing a mutation.
  expectTypeOf(proveReadonly).toBeFunction();
});
