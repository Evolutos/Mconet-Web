// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ArtifactCatalog } from "./artifact-catalog.js";
import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { ModelTaskResult } from "./model-task-result.js";
import type { TaskDescriptor } from "./task-descriptor.js";
import type { TaskDocument } from "./task-document.js";

it("defines exactly the five values owned by every model-task result", () => {
  // Exact equality excludes request inputs, model identity, output status,
  // usage, diagnostics, protocol state, projections, and transport behavior.
  expectTypeOf<ModelTaskResult>().toEqualTypeOf<{
    readonly descriptor: TaskDescriptor;
    readonly document: TaskDocument;
    readonly artifacts: ArtifactCatalog;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>();
});

it("accepts an application-defined structural task result", () => {
  const result = {
    ...createModelTaskResult(),
    confidence: 0.97,
  } as const;

  // Structural openness lets a future task family add typed result fields
  // without inheriting an SDK class, registering a type, or changing Core.
  expect(acceptModelTaskResult(result)).toBe(result);
  expect(result.confidence).toBe(0.97);
});

it("keeps the descriptor document and result Artifact scope independent", () => {
  const descriptor = createTaskDescriptor();
  const document = createTaskDocument();
  const artifacts: ArtifactCatalog = { artifacts: [] };
  const metadata = { latencyClass: "interactive" } as const;
  const extensions = { "vendor.confidence": 0.97 } as const;
  const result: ModelTaskResult = {
    descriptor,
    document,
    artifacts,
    metadata,
    extensions,
  };

  // Each boundary remains the producer's original value. No field is inferred,
  // merged, copied, defaulted, or searched outside this result.
  expect(result.descriptor).toBe(descriptor);
  expect(result.document).toBe(document);
  expect(result.artifacts).toBe(artifacts);
  expect(result.metadata).toBe(metadata);
  expect(result.extensions).toBe(extensions);
});

it("owns an ArtifactCatalog independent from the request scope", () => {
  const resultCatalog: ArtifactCatalog = { artifacts: [] };
  const requestCatalog: ArtifactCatalog = { artifacts: [] };
  const result: ModelTaskResult = {
    ...createModelTaskResult(),
    artifacts: resultCatalog,
  };

  // A concrete empty result scope is still distinct from an empty request
  // scope, so a missing result Artifact cannot trigger implicit fallback.
  expect(result.artifacts).toBe(resultCatalog);
  expect(result.artifacts).not.toBe(requestCatalog);
  expect(result.artifacts).toEqual({ artifacts: [] });
});

it("requires the complete result-owned field surface", () => {
  // Descriptor and document alone are incomplete; empty Artifact, metadata,
  // and extension scopes must be represented explicitly rather than inferred.
  expectTypeOf<{
    readonly descriptor: TaskDescriptor;
    readonly document: TaskDocument;
  }>().not.toMatchTypeOf<ModelTaskResult>();
  expectTypeOf<{
    readonly descriptor: TaskDescriptor;
    readonly document: TaskDocument;
    readonly artifacts: ArtifactCatalog;
    readonly metadata: Readonly<Record<string, JsonValue>>;
  }>().not.toMatchTypeOf<ModelTaskResult>();
});

it("prevents replacement of result-owned values", () => {
  const proveReadonly = (
    result: ModelTaskResult,
    descriptor: TaskDescriptor,
    document: TaskDocument,
    artifacts: ArtifactCatalog,
  ): void => {
    // Compile representative invalid writes while keeping this helper
    // unreachable from runtime tests and unable to mutate result values.
    // @ts-expect-error Task-result descriptor cannot be replaced.
    result.descriptor = descriptor;
    // @ts-expect-error Task-result document cannot be replaced.
    result.document = document;
    // @ts-expect-error Result-local Artifact scope cannot be replaced.
    result.artifacts = artifacts;
    // @ts-expect-error Result metadata entries remain readonly.
    result.metadata.status = "changed";
    // @ts-expect-error Result extension entries remain readonly.
    result.extensions["vendor.option"] = null;
  };

  // Retain the helper so strict TypeScript validates every readonly constraint
  // without executing its intentionally invalid assignments.
  expectTypeOf(proveReadonly).toBeFunction();
});

/** Returns a structurally supplied task result unchanged. */
function acceptModelTaskResult(result: ModelTaskResult): ModelTaskResult {
  // The identity return proves this interface adds no constructor, registry,
  // normalization, validation, copy, or runtime dispatch side effect.
  return result;
}

/** Creates one complete open descriptor for result-boundary tests. */
function createTaskDescriptor(): TaskDescriptor {
  // Keep result identity and Schema references independent from the document so
  // consumers never need to infer them from concrete tree contents.
  return {
    type: "vendor.document_compare",
    version: "2026.10",
    inputSchemaId: "schema.vendor.input",
    outputSchemaId: "schema.vendor.result",
    metadata: {
      owner: "integration",
    },
    extensions: {},
  };
}

/** Creates one complete versioned TaskDocument with an empty result root. */
function createTaskDocument(): TaskDocument {
  // The document owns only its ordered result tree and portable annotations; it
  // does not acquire result-local Artifacts or outer interaction state.
  return {
    version: "1.0",
    root: {
      id: "result-root",
      kind: "task.result_root",
      composition: "container",
      children: [],
      relations: [],
      metadata: {},
      extensions: {},
    },
    metadata: {},
    extensions: {},
  };
}

/** Creates the smallest complete task result with explicit empty scopes. */
function createModelTaskResult(): ModelTaskResult {
  // Every always-present boundary is supplied explicitly. Empty collections and
  // maps are real values rather than defaults, nulls, or unresolved sentinels.
  return {
    descriptor: createTaskDescriptor(),
    document: createTaskDocument(),
    artifacts: {
      artifacts: [],
    },
    metadata: {},
    extensions: {},
  };
}
