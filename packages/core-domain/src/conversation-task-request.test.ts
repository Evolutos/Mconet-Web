// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ArtifactCatalog } from "./artifact-catalog.js";
import type { ConversationTaskRequest } from "./conversation-task-request.js";
import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { ModelTaskRequest } from "./model-task-request.js";
import type { TaskDescriptor } from "./task-descriptor.js";
import type { TaskDocument } from "./task-document.js";

it("retains the common task request surface with a fixed descriptor type", () => {
  // Exact equality permits only the five task-owned values and narrows the open
  // descriptor identity without duplicating document or Artifact fields.
  expectTypeOf<ConversationTaskRequest>().toEqualTypeOf<{
    readonly descriptor: TaskDescriptor & {
      readonly type: "conversation.generate";
    };
    readonly document: TaskDocument;
    readonly artifacts: ArtifactCatalog;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>();
});

it("is an open model task request with conversation identity", () => {
  const request = createConversationTaskRequest();

  // The concrete request crosses the common structural boundary unchanged,
  // while task selection can read the fixed type without inspecting its tree.
  expect(acceptModelTaskRequest(request)).toBe(request);
  expect(request.descriptor.type).toBe("conversation.generate");
  expectTypeOf(request).toMatchTypeOf<ModelTaskRequest>();
});

it("preserves document Artifact and annotation boundaries", () => {
  const request = createConversationTaskRequest();
  const { descriptor, document, artifacts, metadata, extensions } = request;

  // Reading one boundary does not derive, merge, copy, or mutate any sibling;
  // Message data remains absent from the top-level request shape.
  expect(request.descriptor).toBe(descriptor);
  expect(request.document).toBe(document);
  expect(request.artifacts).toBe(artifacts);
  expect(request.metadata).toBe(metadata);
  expect(request.extensions).toBe(extensions);
  expect("messages" in request).toBe(false);
});

it("rejects non-conversation task descriptors", () => {
  // An otherwise complete task request cannot acquire conversation semantics
  // from document contents, a model name, or an open non-conversation type.
  expectTypeOf<{
    readonly descriptor: TaskDescriptor & { readonly type: "embedding.generate" };
    readonly document: TaskDocument;
    readonly artifacts: ArtifactCatalog;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<ConversationTaskRequest>();
  expectTypeOf<ModelTaskRequest>().not.toMatchTypeOf<ConversationTaskRequest>();
});

it("prevents replacement of the fixed descriptor and common values", () => {
  const proveReadonly = (
    request: ConversationTaskRequest,
    descriptor: ConversationTaskRequest["descriptor"],
    document: TaskDocument,
  ): void => {
    // Compile invalid writes without executing this helper or mutating a request.
    // @ts-expect-error Fixed conversation descriptor cannot be replaced.
    request.descriptor = descriptor;
    // @ts-expect-error Fixed conversation type cannot be reclassified.
    request.descriptor.type = "embedding.generate";
    // @ts-expect-error Inherited TaskDocument reference cannot be replaced.
    request.document = document;
    // @ts-expect-error Inherited metadata entries remain readonly.
    request.metadata.status = "changed";
  };

  // Retain the helper so strict TypeScript checks every readonly constraint.
  expectTypeOf(proveReadonly).toBeFunction();
});

/** Returns a conversation request through the open task request boundary. */
function acceptModelTaskRequest(request: ModelTaskRequest): ModelTaskRequest {
  // Structural acceptance performs no registration, copy, validation, or task
  // inference and therefore preserves the caller's exact object identity.
  return request;
}

/** Creates one complete conversation request without builder defaults. */
function createConversationTaskRequest(): ConversationTaskRequest {
  const descriptor = {
    type: "conversation.generate",
    metadata: {},
    extensions: {},
  } as const satisfies ConversationTaskRequest["descriptor"];
  const document: TaskDocument = {
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
  const artifacts: ArtifactCatalog = { artifacts: [] };
  const metadata = { locale: "zh-CN" } as const;
  const extensions = { "application.request": true } as const;

  // Supply each required boundary explicitly. Tree contents and parameter
  // semantics remain for the dedicated request validator implemented later.
  return {
    descriptor,
    document,
    artifacts,
    metadata,
    extensions,
  };
}
