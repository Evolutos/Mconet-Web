// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ModelTaskRequest } from "./model-task-request.js";
import type { ProcessingResult } from "./processing-result.js";
import { validateConversationTaskTypeSupport } from "./validate-conversation-task-type-support.js";

it("returns the original supported conversation request without diagnostics", () => {
  const request = createTaskRequest("conversation.generate");
  const before = structuredClone(request);
  const result = validateConversationTaskTypeSupport(request);

  // Identity and deep equality prove the gate does not copy, freeze, normalize,
  // validate, or modify any descriptor, document, Artifact, or annotation data.
  expect(result).toEqual({ value: request, diagnostics: [] });
  expect(result.value).toBe(request);
  expect(request).toEqual(before);
});

it("rejects an open non-conversation task with one stable diagnostic", () => {
  const request = createTaskRequest("vendor.document_compare");
  const result = validateConversationTaskTypeSupport(request);

  // Exact diagnostic content is the portable failure contract consumed before
  // planning or network work; no unusable request value accompanies the error.
  expect(result).toEqual({
    diagnostics: [
      {
        code: "unsupported_task",
        severity: "error",
        phase: "validation",
        message: "Only conversation generation is supported by this execution path.",
        path: "descriptor.type",
        details: {
          taskType: "vendor.document_compare",
          supportedTaskType: "conversation.generate",
        },
      },
    ],
  });
  expect(Object.hasOwn(result, "value")).toBe(false);
});

it("does not infer support from version Schema identities or annotations", () => {
  const request = createTaskRequest("vendor.conversation_alias");
  const descriptor = request.descriptor as {
    version?: string;
    inputSchemaId?: string;
    outputSchemaId?: string;
    metadata: Readonly<Record<string, unknown>>;
    extensions: Readonly<Record<string, unknown>>;
  };
  descriptor.version = "conversation.generate";
  descriptor.inputSchemaId = "https://schemas.evolutos.com/mconet/model/request";
  descriptor.outputSchemaId = "https://schemas.evolutos.com/mconet/model/output";
  descriptor.metadata = { taskType: "conversation.generate" };
  descriptor.extensions = { "vendor.alias": "conversation.generate" };

  // Only the authoritative type field selects the execution range. Matching
  // text in all other descriptor channels cannot opt an open task into support.
  const result = validateConversationTaskTypeSupport(request);
  expect(result.value).toBeUndefined();
  expect(result.diagnostics[0]?.code).toBe("unsupported_task");
  expect(result.diagnostics[0]?.details).toEqual({
    taskType: "vendor.conversation_alias",
    supportedTaskType: "conversation.generate",
  });
});

it("does not inspect task document or Artifact content", () => {
  let documentReadCount = 0;
  let artifactsReadCount = 0;
  const request = {
    descriptor: {
      type: "conversation.generate",
      metadata: {},
      extensions: {},
    },
    get document(): never {
      // Throw if the type gate crosses into structural Task validation.
      documentReadCount += 1;
      throw new Error("document must not be read");
    },
    get artifacts(): never {
      // Throw if the type gate crosses into Artifact range validation.
      artifactsReadCount += 1;
      throw new Error("artifacts must not be read");
    },
    metadata: {},
    extensions: {},
  } as ModelTaskRequest;

  // The typed precondition places structural correctness before this gate. Only
  // descriptor.type is necessary for this single execution-range decision.
  expect(() => validateConversationTaskTypeSupport(request)).not.toThrow();
  expect(validateConversationTaskTypeSupport(request).value).toBe(request);
  expect(documentReadCount).toBe(0);
  expect(artifactsReadCount).toBe(0);
});

it("returns deterministic independent failure envelopes", () => {
  const request = createTaskRequest("embedding.generate");
  const first = validateConversationTaskTypeSupport(request);
  const second = validateConversationTaskTypeSupport(request);

  // Repeated checks preserve diagnostic data semantics but allocate independent
  // result collections, preventing caller mutation from becoming shared state.
  expect(first).toEqual(second);
  expect(first).not.toBe(second);
  expect(first.diagnostics).not.toBe(second.diagnostics);
});

it("exposes one narrow open-request processing signature", () => {
  // Lock the API to a non-throwing gate over ModelTaskRequest. A narrower
  // ConversationTaskRequest input could never report unsupported task types.
  expectTypeOf(validateConversationTaskTypeSupport).toEqualTypeOf<
    (request: ModelTaskRequest) => ProcessingResult<ModelTaskRequest>
  >();
});

/** Creates one structurally complete open task request for type-gate tests. */
function createTaskRequest(taskType: string): ModelTaskRequest {
  // Non-empty document and Artifact annotations make it observable that the
  // gate decides only from descriptor.type and preserves every other value.
  return {
    descriptor: {
      type: taskType,
      metadata: { displayName: "Fixture task" },
      extensions: { "vendor.task": true },
    },
    document: {
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
      metadata: { fixture: "task-type-support" },
      extensions: {},
    },
    artifacts: { artifacts: [] },
    metadata: { sequence: 1 },
    extensions: { "vendor.request": true },
  };
}
