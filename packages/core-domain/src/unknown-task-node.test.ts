// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { OpenIdentifier } from "./open-identifier.js";
import type { RawPayload } from "./raw-payload.js";
import type { TaskRelation } from "./task-relation.js";
import type { UnknownTaskNode } from "./unknown-task-node.js";

it("defines only unknown Task-leaf semantics and shared fields", () => {
  // Exact equality excludes children, typed task configuration, Message data,
  // Artifact data, protocol payloads, and executable behavior.
  expectTypeOf<UnknownTaskNode>().toEqualTypeOf<{
    readonly id: string;
    readonly kind: OpenIdentifier;
    readonly relations: readonly TaskRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
    readonly composition: "leaf";
    readonly raw?: RawPayload;
  }>();
});

it("preserves an integration-defined leaf kind with bounded raw data", () => {
  const raw: RawPayload = {
    mediaType: "application/vnd.provider.task-node+json",
    schemaId: "provider.task-node.v1",
    bytes: new Uint8Array([123, 125]),
    truncated: false,
    metadata: {
      source: "request",
    },
  };
  const node: UnknownTaskNode = {
    id: "task-provider-options",
    kind: "provider.task.options",
    composition: "leaf",
    raw,
    relations: [],
    metadata: {},
    extensions: {},
  };

  // Preserve open kind and RawPayload identity without decoding, copying, or
  // promoting raw metadata into typed Task fields.
  expect(node.kind).toBe("provider.task.options");
  expect(node.raw).toBe(raw);
  expect([...raw.bytes]).toEqual([123, 125]);
});

it("represents a standard unknown leaf without a raw sentinel", () => {
  const node: UnknownTaskNode = {
    id: "task-unknown",
    kind: "task.unknown",
    composition: "leaf",
    relations: [],
    metadata: {
      preservationReason: "unsupported-by-current-runtime",
    },
    extensions: {},
  };

  // A standard unknown identity remains exact while true raw absence avoids an
  // empty payload that would falsely claim source completeness or byte access.
  expect(node.kind).toBe("task.unknown");
  expect(Object.hasOwn(node, "raw")).toBe(false);
  expect(node.raw).toBeUndefined();
});

it("keeps unknown containers in the separate group representation", () => {
  // UnknownTaskNode is always a leaf. An object with container composition and
  // children cannot satisfy this interface even when its kind is open.
  expectTypeOf<{
    readonly id: string;
    readonly kind: "provider.task.container";
    readonly composition: "container";
    readonly children: readonly [];
    readonly relations: readonly TaskRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<UnknownTaskNode>();
});

it("requires shared fields and leaf composition while keeping raw optional", () => {
  // Missing identity, kind, composition, relations, metadata, or extensions is
  // invalid even though the preservation payload itself can be truly absent.
  expectTypeOf<{
    readonly kind: OpenIdentifier;
    readonly composition: "leaf";
    readonly relations: readonly TaskRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<UnknownTaskNode>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: OpenIdentifier;
    readonly relations: readonly TaskRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<UnknownTaskNode>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: OpenIdentifier;
    readonly composition: "leaf";
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<UnknownTaskNode>();
});

it("prevents replacement of unknown leaf and shared data", () => {
  const proveReadonly = (node: UnknownTaskNode): void => {
    // Compile representative forbidden writes while keeping this helper
    // unreachable from runtime tests and unable to mutate constructed data.
    // @ts-expect-error The preserved Task-node kind cannot be replaced.
    node.kind = "provider.task.changed";
    // @ts-expect-error Leaf composition cannot be replaced with a container.
    node.composition = "container";
    // @ts-expect-error The optional RawPayload reference cannot be replaced.
    node.raw = undefined;
    // @ts-expect-error Inherited identity cannot be replaced.
    node.id = "task-changed";
    // @ts-expect-error Inherited metadata entries remain readonly.
    node.metadata.status = "changed";
    // @ts-expect-error Inherited extension entries remain readonly.
    node.extensions["provider.task"] = null;
  };

  // Retain the helper so strict TypeScript validates every readonly constraint
  // without executing its intentionally invalid assignments.
  expectTypeOf(proveReadonly).toBeFunction();
});
