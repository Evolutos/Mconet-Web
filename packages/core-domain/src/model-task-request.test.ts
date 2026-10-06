// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ArtifactCatalog } from "./artifact-catalog.js";
import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { ModelTaskRequest } from "./model-task-request.js";
import type { TaskDescriptor } from "./task-descriptor.js";
import type { TaskDocument } from "./task-document.js";

it("defines exactly the five values owned by every model task", () => {
  // Exact equality excludes Message shortcuts, model targets, service access,
  // credentials, protocol payloads, transport state, and execution behavior.
  expectTypeOf<ModelTaskRequest>().toEqualTypeOf<{
    readonly descriptor: TaskDescriptor;
    readonly document: TaskDocument;
    readonly artifacts: ArtifactCatalog;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>();
});

it("accepts an application-defined structural task request", () => {
  const request = {
    ...createModelTaskRequest(),
    comparisonMode: "semantic",
  } as const;

  // Structural openness lets a future task family add typed fields without
  // inheriting an SDK class, registering an identifier, or changing Core.
  expect(acceptModelTaskRequest(request)).toBe(request);
  expect(request.comparisonMode).toBe("semantic");
});

it("keeps the descriptor document and Artifact scope independent", () => {
  const descriptor = createTaskDescriptor();
  const document = createTaskDocument();
  const artifacts: ArtifactCatalog = { artifacts: [] };
  const metadata = { traceLabel: "comparison" } as const;
  const extensions = { "vendor.priority": 2 } as const;
  const request: ModelTaskRequest = {
    descriptor,
    document,
    artifacts,
    metadata,
    extensions,
  };

  // Each boundary remains the caller's original value. No field is inferred,
  // merged, copied, defaulted, or searched outside the local request scope.
  expect(request.descriptor).toBe(descriptor);
  expect(request.document).toBe(document);
  expect(request.artifacts).toBe(artifacts);
  expect(request.metadata).toBe(metadata);
  expect(request.extensions).toBe(extensions);
});

it("requires a concrete ArtifactCatalog even when it is empty", () => {
  const complete = createModelTaskRequest();

  // Explicit empty membership means the local resolution scope is known and
  // contains no Artifacts; omission must not mean unresolved or global lookup.
  expect(complete.artifacts).toEqual({ artifacts: [] });
  expectTypeOf<{
    readonly descriptor: TaskDescriptor;
    readonly document: TaskDocument;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<ModelTaskRequest>();
});

it("rejects incomplete and Message-shaped substitutes", () => {
  // A descriptor plus tree is still incomplete, and MessageDocument cannot
  // replace the task request merely because it also owns metadata/extensions.
  expectTypeOf<{
    readonly descriptor: TaskDescriptor;
    readonly document: TaskDocument;
  }>().not.toMatchTypeOf<ModelTaskRequest>();
  expectTypeOf<{
    readonly version: string;
    readonly purpose: "input";
    readonly root: unknown;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<ModelTaskRequest>();
});

it("prevents replacement of task-owned values", () => {
  const proveReadonly = (
    request: ModelTaskRequest,
    descriptor: TaskDescriptor,
    document: TaskDocument,
    artifacts: ArtifactCatalog,
  ): void => {
    // Compile representative invalid writes while keeping this helper
    // unreachable from runtime tests and unable to mutate request values.
    // @ts-expect-error Task descriptor cannot be replaced.
    request.descriptor = descriptor;
    // @ts-expect-error Task document cannot be replaced.
    request.document = document;
    // @ts-expect-error Request-local Artifact scope cannot be replaced.
    request.artifacts = artifacts;
    // @ts-expect-error Request metadata entries remain readonly.
    request.metadata.status = "changed";
    // @ts-expect-error Request extension entries remain readonly.
    request.extensions["vendor.option"] = null;
  };

  // Retain the helper so strict TypeScript validates every readonly constraint
  // without executing its intentionally invalid assignments.
  expectTypeOf(proveReadonly).toBeFunction();
});

/** Returns a structurally supplied task request unchanged. */
function acceptModelTaskRequest(request: ModelTaskRequest): ModelTaskRequest {
  // The identity return proves this interface adds no constructor, registry,
  // normalization, validation, copy, or runtime dispatch side effect.
  return request;
}

/** Creates one complete open descriptor for request-boundary tests. */
function createTaskDescriptor(): TaskDescriptor {
  // Keep task identity and Schema references independent from the document so
  // selection never needs to infer them from tree contents.
  return {
    type: "vendor.document_compare",
    version: "2026.10",
    inputSchemaId: "schema.vendor.input",
    outputSchemaId: "schema.vendor.output",
    metadata: {
      owner: "application",
    },
    extensions: {},
  };
}

/** Creates one complete versioned TaskDocument with an empty root group. */
function createTaskDocument(): TaskDocument {
  // The document owns only its ordered Task tree and portable annotations; it
  // does not acquire request-local Artifacts or outer interaction state.
  return {
    version: "1.0",
    root: {
      id: "task-root",
      kind: "task.root",
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

/** Creates the smallest complete model-task request with explicit empty scopes. */
function createModelTaskRequest(): ModelTaskRequest {
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
