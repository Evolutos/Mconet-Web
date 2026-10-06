// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { MessageContentKind } from "./message-content-kind.js";

/** Standard content kinds whose identities are defined by the architecture. */
const standardMessageContentKinds = [
  "content.text",
  "content.json",
  "content.artifact",
  "content.unknown",
] as const satisfies readonly MessageContentKind[];

it("includes every standard message-content kind as a literal", () => {
  // Extract the standard branch to prove every documented literal remains
  // represented without relying only on the open string arm.
  expectTypeOf<
    Extract<MessageContentKind, (typeof standardMessageContentKinds)[number]>
  >().toEqualTypeOf<(typeof standardMessageContentKinds)[number]>();

  // Guard the exact standard vocabulary and stable order used by documentation
  // and cross-language fixtures without assigning runtime support semantics.
  expect(standardMessageContentKinds).toEqual([
    "content.text",
    "content.json",
    "content.artifact",
    "content.unknown",
  ]);
});

it("preserves integration-defined and future content kinds", () => {
  const integrationKind = "provider.content.citation";
  const dynamicKind: string = integrationKind;
  const kinds: readonly MessageContentKind[] = [integrationKind, dynamicKind];

  // Both literal and runtime strings remain assignable so an integration does
  // not need to modify core-domain merely to preserve a new content identity.
  expectTypeOf<string>().toMatchTypeOf<MessageContentKind>();
  expect(kinds).toEqual([integrationKind, dynamicKind]);
});

it("rejects non-string content-kind representations", () => {
  // A content kind is an identifier, never a numeric tag, nullable sentinel,
  // boolean feature switch, or object wrapper.
  expectTypeOf<number>().not.toMatchTypeOf<MessageContentKind>();
  expectTypeOf<boolean>().not.toMatchTypeOf<MessageContentKind>();
  expectTypeOf<null>().not.toMatchTypeOf<MessageContentKind>();
  expectTypeOf<{ readonly kind: string }>().not.toMatchTypeOf<MessageContentKind>();
});
