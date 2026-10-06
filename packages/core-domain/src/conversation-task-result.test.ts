// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ArtifactCatalog } from "./artifact-catalog.js";
import type { ConversationTaskResult } from "./conversation-task-result.js";
import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { MessageDocument } from "./message-document.js";
import type { ModelTaskResult } from "./model-task-result.js";
import type { TaskDescriptor } from "./task-descriptor.js";
import type { TaskDocument } from "./task-document.js";

it("retains the common result surface with conversation identity and messages", () => {
  // Exact equality narrows only task identity and adds the independent Message
  // document; parsed-response facts, projections, and runtime behavior stay out.
  expectTypeOf<ConversationTaskResult>().toEqualTypeOf<{
    readonly descriptor: TaskDescriptor & {
      readonly type: "conversation.generate";
    };
    readonly document: TaskDocument;
    readonly artifacts: ArtifactCatalog;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
    readonly messages: MessageDocument;
  }>();
});

it("is an open model task result with fixed conversation identity", () => {
  const result = createConversationTaskResult();

  // The concrete conversation result crosses the common structural boundary
  // unchanged, and task selection never needs to inspect Message tree contents.
  expect(acceptModelTaskResult(result)).toBe(result);
  expect(result.descriptor.type).toBe("conversation.generate");
  expectTypeOf(result).toMatchTypeOf<ModelTaskResult>();
});

it("retains the complete MessageDocument independently from TaskDocument", () => {
  const result = createConversationTaskResult();
  const { document, messages, artifacts, metadata, extensions } = result;

  // Both domain documents keep their original references and independent Schema
  // versions; no Message element is flattened into a top-level result field.
  expect(result.document).toBe(document);
  expect(result.messages).toBe(messages);
  expect(result.document.version).toBe("1.0");
  expect(result.messages.version).toBe("2.0");
  expect(result.messages.purpose).toBe("output");
  expect(result.artifacts).toBe(artifacts);
  expect(result.metadata).toBe(metadata);
  expect(result.extensions).toBe(extensions);
  expect("text" in result).toBe(false);
});

it("rejects non-conversation descriptors and missing Message documents", () => {
  // Neither a complete result of another task family nor a common result without
  // the Message payload can acquire conversation-result semantics implicitly.
  expectTypeOf<{
    readonly descriptor: TaskDescriptor & { readonly type: "embedding.generate" };
    readonly document: TaskDocument;
    readonly artifacts: ArtifactCatalog;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
    readonly messages: MessageDocument;
  }>().not.toMatchTypeOf<ConversationTaskResult>();
  expectTypeOf<ModelTaskResult>().not.toMatchTypeOf<ConversationTaskResult>();
});

it("does not require Message output purpose at the type boundary", () => {
  const messages = {
    ...createMessageDocument(),
    purpose: "vendor.partial_output",
  } as const satisfies MessageDocument;
  const result: ConversationTaskResult = {
    ...createConversationTaskResult(),
    messages,
  };

  // The interface preserves an integration-defined purpose without normalizing
  // it; response validation can later decide whether a protocol permits it.
  expect(result.messages).toBe(messages);
  expect(result.messages.purpose).toBe("vendor.partial_output");
});

it("prevents replacement of conversation result values", () => {
  const proveReadonly = (
    result: ConversationTaskResult,
    descriptor: ConversationTaskResult["descriptor"],
    document: TaskDocument,
    messages: MessageDocument,
  ): void => {
    // Compile invalid writes without executing this helper or mutating a result.
    // @ts-expect-error Fixed conversation descriptor cannot be replaced.
    result.descriptor = descriptor;
    // @ts-expect-error Fixed conversation type cannot be reclassified.
    result.descriptor.type = "embedding.generate";
    // @ts-expect-error Inherited TaskDocument reference cannot be replaced.
    result.document = document;
    // @ts-expect-error MessageDocument reference cannot be replaced.
    result.messages = messages;
    // @ts-expect-error Inherited metadata entries remain readonly.
    result.metadata.status = "changed";
  };

  // Retain the helper so strict TypeScript checks every readonly constraint.
  expectTypeOf(proveReadonly).toBeFunction();
});

/** Returns a conversation result through the open task-result boundary. */
function acceptModelTaskResult(result: ModelTaskResult): ModelTaskResult {
  // Structural acceptance performs no registration, copy, validation, result
  // inference, or Message projection and preserves the exact object identity.
  return result;
}

/** Creates one complete conversation result without builders or defaults. */
function createConversationTaskResult(): ConversationTaskResult {
  const descriptor = {
    type: "conversation.generate",
    metadata: {},
    extensions: {},
  } as const satisfies ConversationTaskResult["descriptor"];
  const document: TaskDocument = {
    version: "1.0",
    root: {
      id: "result-root",
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
  const messages = createMessageDocument();
  const artifacts: ArtifactCatalog = { artifacts: [] };
  const metadata = { providerRequestId: "request-7" } as const;
  const extensions = { "vendor.confidence": 0.92 } as const;

  // Supply all common and conversation-specific boundaries explicitly. This
  // type-only construction performs no recursive semantic validation.
  return {
    descriptor,
    document,
    messages,
    artifacts,
    metadata,
    extensions,
  };
}

/** Creates one independently versioned conversation output document. */
function createMessageDocument(): MessageDocument {
  // Keep the Message tree complete and separate from Task structure, result
  // Artifacts, metadata, protocol state, and later text projections.
  return {
    version: "2.0",
    purpose: "output",
    root: {
      id: "message-root",
      kind: "message.root",
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
