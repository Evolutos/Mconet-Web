// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { ModelDescriptor } from "./model-descriptor.js";
import type { OpenIdentifier } from "./open-identifier.js";

it("defines the complete immutable model descriptor shape", () => {
  // Assert the exact public surface so later changes cannot silently add
  // behavior, platform values, or another required identity field.
  expectTypeOf<ModelDescriptor>().toEqualTypeOf<{
    readonly name: string;
    readonly displayName?: string;
    readonly family?: OpenIdentifier;
    readonly version?: string;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>();
});

it("requires only the protocol name among descriptive model fields", () => {
  // Empty always-present maps carry no model-specific information, proving the
  // optional descriptive fields are unnecessary for a minimal descriptor.
  const descriptor: ModelDescriptor = {
    name: "example-model",
    metadata: {},
    extensions: {},
  };

  expect(descriptor).toEqual({
    name: "example-model",
    metadata: {},
    extensions: {},
  });
  expect(Object.hasOwn(descriptor, "displayName")).toBe(false);
  expect(Object.hasOwn(descriptor, "family")).toBe(false);
  expect(Object.hasOwn(descriptor, "version")).toBe(false);
});

it("preserves optional descriptions and JSON-only data", () => {
  // Exercise every field with language-neutral values without assigning any
  // matching or protocol behavior to this data-only interface.
  const descriptor: ModelDescriptor = {
    name: "example-model-2026-10-06",
    displayName: "Example Model",
    family: "example.text",
    version: "2026-10-06",
    metadata: {
      contextWindow: 128_000,
      multimodal: false,
      aliases: ["example-latest"],
    },
    extensions: {
      "vendor.deployment": {
        region: "global",
      },
    },
  };

  expect(descriptor.family).toBe("example.text");
  expect(descriptor.metadata).toEqual({
    contextWindow: 128_000,
    multimodal: false,
    aliases: ["example-latest"],
  });
  expect(descriptor.extensions).toEqual({
    "vendor.deployment": {
      region: "global",
    },
  });
});

it("allows structural implementations to retain unknown domain fields", () => {
  // Build the application-owned shape before narrowing it to the public
  // interface so TypeScript structural compatibility preserves its extra data.
  const applicationDescriptor = {
    name: "private-model",
    metadata: {},
    extensions: {},
    deploymentRegion: "internal-zone",
  } as const;
  const descriptor: ModelDescriptor = applicationDescriptor;

  expect(descriptor.name).toBe("private-model");
  expect(applicationDescriptor.deploymentRegion).toBe("internal-zone");
});

it("rejects non-JSON metadata and extension values at compile time", () => {
  // Compare whole candidate shapes without runtime casts so the test proves the
  // two open maps still stop executable or platform-specific values statically.
  expectTypeOf<{
    readonly name: string;
    readonly metadata: Readonly<Record<string, () => void>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<ModelDescriptor>();
  expectTypeOf<{
    readonly name: string;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Readonly<Record<string, Date>>;
  }>().not.toMatchTypeOf<ModelDescriptor>();
});

it("prevents descriptor and nested map replacement at compile time", () => {
  const proveReadonly = (descriptor: ModelDescriptor): void => {
    // Exercise representative top-level and nested writes only for compile-time
    // verification; this helper is deliberately never invoked at runtime.
    // @ts-expect-error Model protocol identity cannot be replaced.
    descriptor.name = "changed";
    // @ts-expect-error Optional family context cannot be replaced.
    descriptor.family = "changed.family";
    // @ts-expect-error Metadata entries are readonly.
    descriptor.metadata.contextWindow = 1;
    // @ts-expect-error Extension entries are readonly.
    descriptor.extensions["vendor.deployment"] = null;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
