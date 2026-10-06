// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { MessageRole } from "./message-role.js";
import type { OpenIdentifier } from "./open-identifier.js";

it("defines only the immutable open message-role shape", () => {
  // Exact type equality prevents message content, authorization, routing,
  // model parameters, or executable behavior from entering this identity type.
  expectTypeOf<MessageRole>().toEqualTypeOf<{
    readonly id: OpenIdentifier;
    readonly semantic?: string;
    readonly rawValue?: string;
    readonly extensions: Extensions;
  }>();
});

it("expresses every standard message role", () => {
  const roles = [
    { id: "message.system", extensions: {} },
    { id: "message.developer", extensions: {} },
    { id: "message.user", extensions: {} },
    { id: "message.assistant", extensions: {} },
    { id: "message.tool", extensions: {} },
  ] as const satisfies readonly MessageRole[];

  // Preserve the standard identifiers as ordinary open values; this interface
  // does not attach provider behavior or close the vocabulary around them.
  expect(roles.map(({ id }) => id)).toEqual([
    "message.system",
    "message.developer",
    "message.user",
    "message.assistant",
    "message.tool",
  ]);
});

it("preserves an integration-defined role and its source representation", () => {
  const role: MessageRole = {
    id: "provider.review_observer",
    semantic: "observer",
    rawValue: "review-observer-v2",
    extensions: {
      "provider.role": {
        priority: 2,
        canReply: false,
      },
    },
  };

  // Unknown identity, normalized meaning, raw provider spelling, and namespaced
  // JSON data remain independent and are not coerced to a standard role.
  expect(role).toEqual({
    id: "provider.review_observer",
    semantic: "observer",
    rawValue: "review-observer-v2",
    extensions: {
      "provider.role": {
        priority: 2,
        canReply: false,
      },
    },
  });
});

it("allows semantic and raw source values to be absent independently", () => {
  const identityOnly: MessageRole = {
    id: "message.user",
    extensions: {},
  };
  const semanticOnly: MessageRole = {
    id: "provider.human",
    semantic: "user",
    extensions: {},
  };
  const rawOnly: MessageRole = {
    id: "provider.unknown",
    rawValue: "legacy-role",
    extensions: {},
  };

  // True optional properties avoid synthetic empty-string sentinels and allow
  // a boundary adapter to preserve only the source information it possesses.
  expect(Object.hasOwn(identityOnly, "semantic")).toBe(false);
  expect(Object.hasOwn(identityOnly, "rawValue")).toBe(false);
  expect(semanticOnly.semantic).toBe("user");
  expect(Object.hasOwn(semanticOnly, "rawValue")).toBe(false);
  expect(rawOnly.rawValue).toBe("legacy-role");
  expect(Object.hasOwn(rawOnly, "semantic")).toBe(false);
});

it("requires role identity and extensions at compile time", () => {
  // Both fields are structural invariants. Optional source metadata cannot act
  // as a substitute for either the open identity or extension container.
  expectTypeOf<{
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<MessageRole>();
  expectTypeOf<{
    readonly id: OpenIdentifier;
  }>().not.toMatchTypeOf<MessageRole>();
});

it("prevents role and extension replacement at compile time", () => {
  const proveReadonly = (role: MessageRole): void => {
    // Exercise every forbidden write only during compilation; this helper is
    // retained as a value below but never invoked at runtime.
    // @ts-expect-error Role identity cannot be replaced.
    role.id = "message.assistant";
    // @ts-expect-error Normalized semantics cannot be replaced.
    role.semantic = "assistant";
    // @ts-expect-error Raw source spelling cannot be replaced.
    role.rawValue = "assistant";
    // @ts-expect-error The extension container cannot be replaced.
    role.extensions = {};
    // @ts-expect-error Individual extension entries are readonly.
    role.extensions["provider.role"] = null;
  };

  // Keeping the helper reachable ensures strict TypeScript checking continues
  // to validate all readonly assignments without performing a runtime mutation.
  expectTypeOf(proveReadonly).toBeFunction();
});
