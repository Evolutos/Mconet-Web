// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { OpenIdentifier } from "./open-identifier.js";
import type { TaskDescriptor } from "./task-descriptor.js";

it("defines only the immutable Task descriptor shape", () => {
  // Exact equality prevents interaction mode, document, artifacts, model target,
  // access, protocol, or runtime behavior from entering this data abstraction.
  expectTypeOf<TaskDescriptor>().toEqualTypeOf<{
    readonly type: OpenIdentifier;
    readonly version?: string;
    readonly inputSchemaId?: string;
    readonly outputSchemaId?: string;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>();
});

it("keeps task type version and Schema identities independent", () => {
  const descriptor: TaskDescriptor = {
    type: "conversation.generate",
    version: "2026-10-07",
    inputSchemaId: "https://schemas.example.invalid/tasks/conversation-input",
    outputSchemaId: "https://schemas.example.invalid/tasks/conversation-output",
    metadata: {
      displayName: "对话生成",
      stable: true,
    },
    extensions: {
      "provider.task": {
        priority: 0,
      },
    },
  };

  // Exact values demonstrate that the open task family, opaque version, and two
  // directional Schema identities are retained without parsing or composition.
  expect(descriptor).toEqual({
    type: "conversation.generate",
    version: "2026-10-07",
    inputSchemaId: "https://schemas.example.invalid/tasks/conversation-input",
    outputSchemaId: "https://schemas.example.invalid/tasks/conversation-output",
    metadata: {
      displayName: "对话生成",
      stable: true,
    },
    extensions: {
      "provider.task": {
        priority: 0,
      },
    },
  });
});

it("preserves an integration-defined task type with optional fields absent", () => {
  const descriptor: TaskDescriptor = {
    type: "provider.semantic_merge",
    metadata: {},
    extensions: {},
  };

  // Open type identity does not require SDK vocabulary changes. True absence
  // avoids inventing empty version or Schema-ID sentinel strings.
  expect(descriptor.type).toBe("provider.semantic_merge");
  expect(Object.hasOwn(descriptor, "version")).toBe(false);
  expect(Object.hasOwn(descriptor, "inputSchemaId")).toBe(false);
  expect(Object.hasOwn(descriptor, "outputSchemaId")).toBe(false);
});

it("requires type metadata and extensions at compile time", () => {
  // Optional contract labels cannot replace the three fields needed for stable
  // open identity and always-present portable maps.
  expectTypeOf<{
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<TaskDescriptor>();
  expectTypeOf<{
    readonly type: OpenIdentifier;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<TaskDescriptor>();
  expectTypeOf<{
    readonly type: OpenIdentifier;
    readonly metadata: Readonly<Record<string, JsonValue>>;
  }>().not.toMatchTypeOf<TaskDescriptor>();
});

it("prevents descriptor and nested map replacement at compile time", () => {
  const proveReadonly = (descriptor: TaskDescriptor): void => {
    // Exercise representative forbidden writes during compilation. This helper
    // remains reachable below but is never invoked against runtime data.
    // @ts-expect-error Task type cannot be replaced.
    descriptor.type = "embedding.create";
    // @ts-expect-error Task contract version cannot be replaced.
    descriptor.version = "next";
    // @ts-expect-error Input Schema identity cannot be replaced.
    descriptor.inputSchemaId = "replacement";
    // @ts-expect-error Output Schema identity cannot be replaced.
    descriptor.outputSchemaId = "replacement";
    // @ts-expect-error Metadata container cannot be replaced.
    descriptor.metadata = {};
    // @ts-expect-error Individual metadata entries remain readonly.
    descriptor.metadata.status = "changed";
    // @ts-expect-error Extension container cannot be replaced.
    descriptor.extensions = {};
    // @ts-expect-error Individual extension entries remain readonly.
    descriptor.extensions["provider.task"] = null;
  };

  // Retaining the helper makes strict TypeScript verify every readonly contract
  // without executing its intentionally forbidden assignments.
  expectTypeOf(proveReadonly).toBeFunction();
});
