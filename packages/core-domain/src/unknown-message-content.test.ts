// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { OpenIdentifier } from "./open-identifier.js";
import type { RawPayload } from "./raw-payload.js";
import type { UnknownMessageContent } from "./unknown-message-content.js";

it("defines only unknown-content semantics and shared immutable fields", () => {
  // Exact equality prevents typed text, JSON, artifact, role, tree, task, and
  // protocol behavior from entering the preservation-only representation.
  expectTypeOf<UnknownMessageContent>().toEqualTypeOf<{
    readonly id: string;
    readonly kind: OpenIdentifier;
    readonly raw?: RawPayload;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>();
});

it("preserves an integration-defined kind with bounded raw data", () => {
  const raw: RawPayload = {
    mediaType: "application/vnd.provider.citation+json",
    schemaId: "provider.citation.v1",
    bytes: new Uint8Array([123, 125]),
    truncated: false,
    metadata: {
      source: "response",
    },
  };
  const content: UnknownMessageContent = {
    id: "content-citation",
    kind: "provider.content.citation",
    raw,
    metadata: {},
    extensions: {},
  };

  // Preserve kind and RawPayload identity without decoding, copying, or
  // promoting wire metadata into the message-content fields.
  expect(content.kind).toBe("provider.content.citation");
  expect(content.raw).toBe(raw);
  expect([...raw.bytes]).toEqual([123, 125]);
});

it("represents a standard kind without a concrete current content type", () => {
  const content: UnknownMessageContent = {
    id: "content-json",
    kind: "content.json",
    metadata: {
      preservationReason: "unsupported-by-current-runtime",
    },
    extensions: {},
  };

  // A standard identity can remain unknown to this runtime without coercion to
  // content.unknown or a false typed payload.
  expect(content.kind).toBe("content.json");
  expect(Object.hasOwn(content, "raw")).toBe(false);
});

it("allows raw data to be absent without an empty payload sentinel", () => {
  const content: UnknownMessageContent = {
    id: "content-no-bytes",
    kind: "provider.content.opaque",
    metadata: {},
    extensions: {},
  };

  // True absence distinguishes unavailable source bytes from a present empty
  // RawPayload whose completeness and media metadata are known.
  expect(Object.hasOwn(content, "raw")).toBe(false);
  expect(content.raw).toBeUndefined();
});

it("requires shared fields while keeping raw data optional", () => {
  // Missing identity, kind, metadata, or extensions remains invalid even though
  // the preservation payload itself is optional.
  expectTypeOf<{
    readonly kind: OpenIdentifier;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<UnknownMessageContent>();
  expectTypeOf<{
    readonly id: string;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<UnknownMessageContent>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: OpenIdentifier;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<UnknownMessageContent>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: OpenIdentifier;
    readonly metadata: Readonly<Record<string, JsonValue>>;
  }>().not.toMatchTypeOf<UnknownMessageContent>();
});

it("prevents replacement of the unknown kind payload and shared data", () => {
  const proveReadonly = (content: UnknownMessageContent): void => {
    // Exercise concrete and inherited writes only during compilation; this
    // helper is retained below but never invoked at runtime.
    // @ts-expect-error The preserved content kind cannot be replaced.
    content.kind = "provider.content.changed";
    // @ts-expect-error The optional RawPayload reference cannot be replaced.
    content.raw = undefined;
    // @ts-expect-error Inherited content identity cannot be replaced.
    content.id = "content-changed";
    // @ts-expect-error Inherited metadata entries remain readonly.
    content.metadata.status = "changed";
    // @ts-expect-error Inherited extension entries remain readonly.
    content.extensions["provider.content"] = null;
  };

  // Keep the helper reachable so strict TypeScript checking validates every
  // forbidden assignment without executing a runtime mutation.
  expectTypeOf(proveReadonly).toBeFunction();
});
