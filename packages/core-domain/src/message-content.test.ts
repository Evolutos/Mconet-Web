// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { MessageContent } from "./message-content.js";
import type { TextMessageContent } from "./text-message-content.js";
import type { UnknownMessageContent } from "./unknown-message-content.js";

it("contains exactly text and unknown message-content variants", () => {
  // Exact union equality prevents unrelated message elements, tasks, artifacts,
  // or protocol payloads from entering this content-only abstraction.
  expectTypeOf<MessageContent>().toEqualTypeOf<TextMessageContent | UnknownMessageContent>();
});

it("narrows typed text from open unknown content by payload presence", () => {
  const text: TextMessageContent = {
    id: "content-text",
    kind: "content.text",
    text: "Hello",
    metadata: {},
    extensions: {},
  };
  const unknown: UnknownMessageContent = {
    id: "content-citation",
    kind: "provider.content.citation",
    metadata: {},
    extensions: {},
  };

  // Runtime results prove both branches use the same helper while its internal
  // type assertions below prove safe compile-time narrowing.
  expect(classifyContentPayload(text)).toBe("text:Hello");
  expect(classifyContentPayload(unknown)).toBe("unknown:provider.content.citation");
});

it("preserves heterogeneous content order and original object identity", () => {
  const first: TextMessageContent = {
    id: "content-1",
    kind: "content.text",
    text: "First",
    metadata: {},
    extensions: {},
  };
  const second: UnknownMessageContent = {
    id: "content-2",
    kind: "provider.content.opaque",
    metadata: {},
    extensions: {},
  };
  const third: TextMessageContent = {
    id: "content-3",
    kind: "content.text",
    text: "Third",
    metadata: {},
    extensions: {},
  };
  const contents: readonly MessageContent[] = [first, second, third];

  // A message entry will own this ordered collection later; the union itself
  // must not clone, sort, group, or normalize its members.
  expect(contents.map(({ id }) => id)).toEqual(["content-1", "content-2", "content-3"]);
  expect(contents[0]).toBe(first);
  expect(contents[1]).toBe(second);
  expect(contents[2]).toBe(third);
});

it("rejects values outside both content variants", () => {
  // Primitive values, tree-like elements, and payloads missing shared metadata
  // cannot satisfy either union member.
  expectTypeOf<string>().not.toMatchTypeOf<MessageContent>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: "message.group";
    readonly children: readonly [];
  }>().not.toMatchTypeOf<MessageContent>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: "content.text";
    readonly text: string;
    readonly extensions: Readonly<Record<string, never>>;
  }>().not.toMatchTypeOf<MessageContent>();
});

/**
 * Produces a test-only payload summary after structurally narrowing the union.
 *
 * @param content Text or unknown content to classify.
 * @returns Stable branch label containing the typed payload or preserved kind.
 */
function classifyContentPayload(content: MessageContent): string {
  // Unknown kind identifiers intentionally include future values and cannot
  // exclude the `content.text` string at the TypeScript type level. Presence of
  // the required text payload therefore provides the sound structural branch.
  if ("text" in content) {
    expectTypeOf(content).toEqualTypeOf<TextMessageContent>();
    return `text:${content.text}`;
  }

  // Only UnknownMessageContent lacks the required text payload in this exact
  // two-member union, leaving its open kind available without a cast.
  expectTypeOf(content).toEqualTypeOf<UnknownMessageContent>();
  return `unknown:${content.kind}`;
}
