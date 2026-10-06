// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ArtifactMetadata } from "./artifact-metadata.js";
import type { JsonValue } from "./json-value.js";

it("defines exactly a readonly string-keyed JsonValue map", () => {
  // Exact equality prevents behavior, components, handles, or typed media fields
  // from being smuggled into the generic Artifact metadata boundary.
  expectTypeOf<ArtifactMetadata>().toEqualTypeOf<Readonly<Record<string, JsonValue>>>();
});

it("preserves empty and recursively JSON-compatible metadata", () => {
  const empty: ArtifactMetadata = {};
  const metadata: ArtifactMetadata = {
    title: "示例",
    archived: false,
    rank: 0,
    optionalValue: null,
    labels: ["primary", "测试"],
    dimensions: { width: 0, height: 1 },
  };

  // Empty maps remain explicit, while false, zero, null, Unicode, arrays, and
  // nested records retain their exact data values without interpretation.
  expect(empty).toEqual({});
  expect(metadata).toEqual({
    title: "示例",
    archived: false,
    rank: 0,
    optionalValue: null,
    labels: ["primary", "测试"],
    dimensions: { width: 0, height: 1 },
  });
});

it("rejects executable and runtime-owned value types at compile time", () => {
  // Functions, promises, and byte views are not JsonValue and therefore cannot
  // turn descriptive metadata into behavior or runtime resource ownership.
  expectTypeOf<Readonly<Record<string, () => void>>>().not.toMatchTypeOf<ArtifactMetadata>();
  expectTypeOf<Readonly<Record<string, Promise<unknown>>>>().not.toMatchTypeOf<ArtifactMetadata>();
  expectTypeOf<Readonly<Record<string, Uint8Array>>>().not.toMatchTypeOf<ArtifactMetadata>();
});

it("prevents metadata entry replacement at compile time", () => {
  const proveReadonly = (metadata: ArtifactMetadata): void => {
    // Exercise the forbidden write only during compilation; this helper remains
    // reachable below but is never invoked against a runtime fixture.
    // @ts-expect-error Artifact metadata entries are readonly.
    metadata.status = "changed";
  };

  // Keep the helper reachable so strict checking validates immutability without
  // mutating shared fixture data.
  expectTypeOf(proveReadonly).toBeFunction();
});
