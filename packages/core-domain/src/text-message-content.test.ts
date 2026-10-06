// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { TextMessageContent } from "./text-message-content.js";

it("defines only immutable text-content semantics and shared fields", () => {
  // Exact equality proves inheritance contributes only the reviewed base fields
  // and excludes raw payloads, artifacts, roles, tree links, and task options.
  expectTypeOf<TextMessageContent>().toEqualTypeOf<{
    readonly id: string;
    readonly kind: "content.text";
    readonly text: string;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>();
});

it("preserves Unicode emoji and line breaks exactly", () => {
  const text = "你好，Mconet 👋\nSecond line\n";
  const content: TextMessageContent = {
    id: "content-unicode",
    kind: "content.text",
    text,
    metadata: {},
    extensions: {},
  };

  // Representation does not trim, normalize, split, or otherwise transform the
  // caller's string before a protocol mapper receives it.
  expect(content.text).toBe(text);
  expect([...content.text]).toContain("👋");
});

it("represents empty text without a sentinel or omitted property", () => {
  const content: TextMessageContent = {
    id: "content-empty",
    kind: "content.text",
    text: "",
    metadata: {},
    extensions: {},
  };

  // Empty text remains an explicit string value. A later validator owns any
  // context-specific acceptance or length policy.
  expect(Object.hasOwn(content, "text")).toBe(true);
  expect(content.text).toBe("");
});

it("preserves metadata and namespaced extensions independently from text", () => {
  const content: TextMessageContent = {
    id: "content-annotated",
    kind: "content.text",
    text: "Reviewed answer",
    metadata: {
      confidence: 0.95,
      labels: ["reviewed"],
    },
    extensions: {
      "provider.text": {
        language: "en",
      },
    },
  };

  // Application metadata and integration extensions remain in separate maps;
  // neither is promoted into the plain-text semantic payload.
  expect(content.metadata).toEqual({
    confidence: 0.95,
    labels: ["reviewed"],
  });
  expect(content.extensions).toEqual({
    "provider.text": {
      language: "en",
    },
  });
});

it("requires the text field and exact discriminator at compile time", () => {
  // Missing payload and any non-text kind are rejected independently so the
  // later union can safely narrow on the literal discriminator.
  expectTypeOf<{
    readonly id: string;
    readonly kind: "content.text";
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<TextMessageContent>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: "content.json";
    readonly text: string;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<TextMessageContent>();
});

it("prevents replacement of the text discriminator and payload", () => {
  const proveReadonly = (content: TextMessageContent): void => {
    // Exercise concrete and inherited writes only during compilation; this
    // helper is retained below but never invoked at runtime.
    // @ts-expect-error The text discriminator is fixed and readonly.
    content.kind = "content.unknown";
    // @ts-expect-error The text payload cannot be replaced.
    content.text = "changed";
    // @ts-expect-error Inherited content identity cannot be replaced.
    content.id = "content-changed";
    // @ts-expect-error Inherited metadata entries remain readonly.
    content.metadata.status = "changed";
    // @ts-expect-error Inherited extension entries remain readonly.
    content.extensions["provider.text"] = null;
  };

  // Keep the helper reachable so strict TypeScript checking validates every
  // forbidden assignment without executing a runtime mutation.
  expectTypeOf(proveReadonly).toBeFunction();
});
