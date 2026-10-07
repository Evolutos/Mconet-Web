// Copyright © 2026 Mcont.

import { beforeAll, describe, expect, it } from "vitest";

import { isModelRequest } from "../../packages/core-domain/src/model-request.js";
import { loadSchemaById } from "../schema-loader.js";
import { SchemaValidatorAdapter } from "../schema-validator-adapter.js";

/** Stable identifier of the self-contained ModelRequest Schema. */
const modelRequestSchemaId = "https://schemas.evolutos.com/mconet/model/request";

/** Existing Schema IDs used to detect embedded-contract drift. */
const modelTargetSchemaId = "https://schemas.evolutos.com/mconet/model/target";
const taskDocumentSchemaId = "https://schemas.evolutos.com/mconet/task/document";
const serviceAccessSchemaId = "https://schemas.evolutos.com/mconet/access/service";
const modelDescriptorSchemaId = "https://schemas.evolutos.com/mconet/model/descriptor";

/** Loaded ModelRequest Schema and independently reviewed component Schemas. */
let modelRequestSchema: Readonly<Record<string, unknown>>;
let modelTargetSchema: Readonly<Record<string, unknown>>;
let taskDocumentSchema: Readonly<Record<string, unknown>>;
let serviceAccessSchema: Readonly<Record<string, unknown>>;
let modelDescriptorSchema: Readonly<Record<string, unknown>>;

/** Strict compiled validator reused by all ModelRequest cases. */
let schemaValidator: SchemaValidatorAdapter;

beforeAll(async () => {
  // Load every artifact through the registry so stable IDs, duplicate detection,
  // deep freezing, and strict compilation all participate in conformance.
  [
    modelRequestSchema,
    modelTargetSchema,
    taskDocumentSchema,
    serviceAccessSchema,
    modelDescriptorSchema,
  ] = await Promise.all([
    loadSchemaById(modelRequestSchemaId),
    loadSchemaById(modelTargetSchemaId),
    loadSchemaById(taskDocumentSchemaId),
    loadSchemaById(serviceAccessSchemaId),
    loadSchemaById(modelDescriptorSchemaId),
  ]);
  schemaValidator = new SchemaValidatorAdapter(modelRequestSchema);
});

describe("ModelRequest Schema", () => {
  // Treat envelope identity, embedded contracts, supported task range, security
  // exclusion, semantic boundaries, and immutability as one Schema acceptance set.
  it("declares the stable identity and complete request envelope", () => {
    const properties = modelRequestSchema.properties as Record<string, unknown>;

    // Exact keyword checks expose accidental public shape or optionality drift.
    expect(modelRequestSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(modelRequestSchema.$id).toBe(modelRequestSchemaId);
    expect(modelRequestSchema.required).toEqual(["target", "task", "metadata", "extensions"]);
    expect(Object.keys(properties)).toEqual([
      "target",
      "task",
      "serviceAccess",
      "metadata",
      "extensions",
    ]);
    expect(modelRequestSchema.additionalProperties).toBe(true);
    expect(Object.isFrozen(modelRequestSchema)).toBe(true);
  });

  it("keeps embedded public component surfaces aligned", () => {
    const definitions = modelRequestSchema.$defs as Record<string, Record<string, unknown>>;
    const embeddedTarget = definitions.modelTarget;
    const embeddedAccess = definitions.serviceAccess;
    const embeddedTaskDocument = definitions.conversationTaskDocument;

    // Compare contract-bearing keywords while allowing request-specific task
    // range narrowing and local descriptions inside the self-contained document.
    expect(Object.keys(embeddedTarget.properties as Record<string, unknown>)).toEqual(
      Object.keys(modelTargetSchema.properties as Record<string, unknown>),
    );
    expect(embeddedTarget.required).toEqual(modelTargetSchema.required);
    expect(embeddedTarget.additionalProperties).toBe(modelTargetSchema.additionalProperties);
    expect(Object.keys(embeddedAccess.properties as Record<string, unknown>)).toEqual(
      Object.keys(serviceAccessSchema.properties as Record<string, unknown>),
    );
    expect(embeddedAccess.required).toEqual(serviceAccessSchema.required);
    expect(embeddedTaskDocument.required).toEqual(taskDocumentSchema.required);
  });

  it("keeps shared identifier and recursive JSON definitions aligned", () => {
    const definitions = modelRequestSchema.$defs as Record<string, unknown>;
    const descriptorDefinitions = modelDescriptorSchema.$defs as Record<string, unknown>;

    // Whole-definition equality prevents grammar drift across self-contained
    // Schemas even though each can compile without an external reference resolver.
    for (const definitionName of [
      "openIdentifier",
      "jsonPrimitive",
      "jsonValue",
      "jsonRecord",
    ] as const) {
      expect(definitions[definitionName]).toEqual(descriptorDefinitions[definitionName]);
    }
  });

  it.each([
    {
      label: "minimal request with truly absent access",
      value: createRequest(),
    },
    {
      label: "complete request with nested input and non-sensitive access",
      value: createRequest({
        endpoint: { kind: "absolute", value: "https://models.example.test/v1/chat" },
        headers: [
          { name: "x-feature", value: "alpha" },
          { name: "x-feature", value: "beta" },
        ],
        query: [{ name: "region", value: "global" }],
        apiVersion: "2026-10",
        projectId: "project-a",
        tenantId: "tenant-a",
        extensions: { "vendor.routing": { enabled: true } },
      }),
    },
  ])("accepts $label in both request contracts", ({ value }) => {
    // The same in-memory object proves target, task, access, JSON maps, Unicode,
    // nested conversation detection, and exact optional absence agree.
    expect(isModelRequest(value)).toBe(true);
    expect(schemaValidator.validate(value)).toBe(true);
  });

  it.each([
    {
      label: "missing target",
      mutate: (request: Record<string, unknown>) => {
        // Target selection is a required independent request boundary.
        Reflect.deleteProperty(request, "target");
      },
    },
    {
      label: "invalid protocol identifier",
      mutate: (request: Record<string, unknown>) => {
        // Protocol identity must use the shared open-identifier grammar.
        (request.target as Record<string, unknown>).protocolId = "invalid protocol";
      },
    },
    {
      label: "wrong task descriptor",
      mutate: (request: Record<string, unknown>) => {
        // Document contents cannot infer or repair task family identity.
        getTaskDescriptor(request).type = "embedding.generate";
      },
    },
    {
      label: "task tree without conversation input",
      mutate: (request: Record<string, unknown>) => {
        // Recursive contains must prove at least one typed input at any depth.
        getTaskRoot(request).children = [createUnknownTaskNode()];
      },
    },
    {
      label: "output-purpose conversation input",
      mutate: (request: Record<string, unknown>) => {
        // Current request messages must have the exact input purpose.
        getInputMessages(request).purpose = "output";
      },
    },
    {
      label: "unknown message content",
      mutate: (request: Record<string, unknown>) => {
        // Structurally preservable future content is outside the text-only range.
        getFirstContent(request).kind = "provider.image";
        Reflect.deleteProperty(getFirstContent(request), "text");
      },
    },
    {
      label: "invalid generation parameter range",
      mutate: (request: Record<string, unknown>) => {
        // Request execution ranges are stricter than generic Task storage shape.
        getGenerationParameters(request).topP = 2;
      },
    },
    {
      label: "non-empty Artifact scope",
      mutate: (request: Record<string, unknown>) => {
        // The current text request range requires an explicit empty Catalog.
        getTask(request).artifacts = { artifacts: [{}] };
      },
    },
    {
      label: "unsafe service endpoint",
      mutate: (request: Record<string, unknown>) => {
        // Ordinary access permits only safe absolute HTTP(S) endpoints.
        request.serviceAccess = {
          endpoint: { kind: "absolute", value: "https://user:secret@example.test/v1" },
          headers: [],
          query: [],
          extensions: {},
        };
      },
    },
    {
      label: "non-JSON request metadata",
      mutate: (request: Record<string, unknown>) => {
        // Envelope metadata is recursively portable data, never behavior.
        request.metadata = { callback: () => undefined };
      },
    },
  ])("rejects $label in both request contracts", ({ mutate }) => {
    const request = createRequest();

    // Each case mutates one fresh valid request so failures remain attributable
    // to the selected composed boundary and cannot leak across cases.
    mutate(request);
    expect(isModelRequest(request)).toBe(false);
    expect(schemaValidator.validate(request)).toBe(false);
  });

  it("excludes Authorization from ordinary request serialization", () => {
    const request = createRequest({
      authorization: { kind: "company.signature", credentialReference: "secure-store-entry" },
      headers: [],
      query: [],
      extensions: {},
    });

    // Runtime configuration accepts the open authorization description, but the
    // language-neutral ordinary Schema rejects the whole field to prevent secure
    // configuration and credential references from entering payload artifacts.
    expect(isModelRequest(request)).toBe(true);
    expect(schemaValidator.validate(request)).toBe(false);
  });

  it("leaves graph-wide Task and Message semantics to Runtime", () => {
    const duplicateTaskId = createRequest();
    const unresolvedTaskRelation = createRequest();
    const unknown = createUnknownTaskNode();
    unknown.id = "conversation-input";
    const rootChildren = getTaskRoot(duplicateTaskId).children as Record<string, unknown>[];
    rootChildren.push({
      id: "separate-group",
      kind: "task.group",
      composition: "container",
      children: [unknown],
      relations: [],
      metadata: {},
      extensions: {},
    });
    getTaskRoot(unresolvedTaskRelation).relations = [
      {
        sourceId: "conversation-input",
        targetId: "missing-node",
        type: "task.precedes",
        metadata: {},
      },
    ];

    // Recursive JSON Schema checks local shapes but cannot maintain a shared ID
    // index or resolve arbitrary relation endpoints across the complete graph.
    expect(schemaValidator.validate(duplicateTaskId)).toBe(true);
    expect(isModelRequest(duplicateTaskId)).toBe(false);
    expect(schemaValidator.validate(unresolvedTaskRelation)).toBe(true);
    expect(isModelRequest(unresolvedTaskRelation)).toBe(false);
  });

  it("preserves unknown request fields without mutation", () => {
    const validRequest = createRequest();
    const invalidRequest = createRequest();
    validRequest.futureOption = { attempts: 0, labels: ["primary", null] };
    (invalidRequest.target as Record<string, unknown>).serviceId = "invalid service";
    const validBefore = structuredClone(validRequest);
    const invalidBefore = structuredClone(invalidRequest);

    // Ajv mutation options remain disabled for both outcomes, and open envelope
    // fields survive validation without being interpreted by the Schema.
    expect(schemaValidator.validate(validRequest)).toBe(true);
    expect(schemaValidator.validate(invalidRequest)).toBe(false);
    expect(validRequest).toEqual(validBefore);
    expect(invalidRequest).toEqual(invalidBefore);
  });
});

/** Creates one complete request with exact optional access omission. */
function createRequest(serviceAccess?: Record<string, unknown>): Record<string, unknown> {
  const request: Record<string, unknown> = {
    target: {
      serviceId: "service.vendor",
      protocolId: "protocol.vendor",
      model: {
        name: "model-a",
        displayName: "Fixture Model",
        family: "family.text",
        metadata: { contextWindow: 128000 },
        extensions: {},
      },
      deploymentId: "deployment-a",
      extensions: {},
    },
    task: createConversationTask(),
    metadata: { traceId: "trace-1" },
    extensions: { "application.priority": 2 },
  };

  // Assign only a present access contribution so undefined remains true absence.
  if (serviceAccess !== undefined) {
    request.serviceAccess = serviceAccess;
  }
  return request;
}

/** Creates one supported conversation task with a nested input group. */
function createConversationTask(): Record<string, unknown> {
  const conversationInput = {
    id: "conversation-input",
    kind: "task.input.conversation",
    composition: "leaf",
    messages: createInputMessages(),
    relations: [],
    metadata: {},
    extensions: {},
  };
  const generation = {
    id: "generation",
    kind: "task.configuration",
    composition: "leaf",
    parameters: {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 256,
      stop: ["done"],
      seed: 42,
    },
    relations: [],
    metadata: {},
    extensions: {},
  };

  // Nest the input to exercise recursive conversation-bearing detection rather
  // than relying only on direct root children.
  return {
    descriptor: {
      type: "conversation.generate",
      version: "1.0",
      inputSchemaId: "schema:conversation-input",
      outputSchemaId: "schema:conversation-output",
      metadata: {},
      extensions: {},
    },
    document: {
      version: "1.0",
      root: {
        id: "task-root",
        kind: "task.root",
        composition: "container",
        children: [
          {
            id: "conversation-section",
            kind: "task.group",
            composition: "container",
            children: [conversationInput, generation],
            relations: [],
            metadata: {},
            extensions: {},
          },
          createUnknownTaskNode(),
        ],
        relations: [],
        metadata: {},
        extensions: {},
      },
      metadata: {},
      extensions: {},
    },
    artifacts: { artifacts: [] },
    metadata: { locale: "zh-CN" },
    extensions: {},
  };
}

/** Creates one valid text-only input MessageDocument. */
function createInputMessages(): Record<string, unknown> {
  // Multiple text segments preserve exact Unicode and order inside one entry.
  return {
    version: "1.0",
    purpose: "input",
    root: {
      id: "message-root",
      kind: "message.root",
      composition: "container",
      children: [
        {
          id: "message-user",
          kind: "message.entry",
          role: { id: "message.user", extensions: {} },
          content: [
            {
              id: "content-a",
              kind: "content.text",
              text: "你好，",
              metadata: {},
              extensions: {},
            },
            {
              id: "content-b",
              kind: "content.text",
              text: "世界 👋",
              metadata: {},
              extensions: {},
            },
          ],
          relations: [],
          metadata: {},
          extensions: {},
        },
      ],
      relations: [],
      metadata: {},
      extensions: {},
    },
    metadata: {},
    extensions: {},
  };
}

/** Creates one structurally preserved unknown Task leaf. */
function createUnknownTaskNode(): Record<string, unknown> {
  // Unknown nodes remain representable until the later explicit execution gate.
  return {
    id: "future-node",
    kind: "provider.future_task",
    composition: "leaf",
    raw: {
      bytes: new Uint8Array([1, 2, 3]),
      truncated: false,
      metadata: {},
    },
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Returns the task envelope from a request Fixture. */
function getTask(request: Record<string, unknown>): Record<string, unknown> {
  // Every helper receives a request produced by createRequest.
  return request.task as Record<string, unknown>;
}

/** Returns the task descriptor from a request Fixture. */
function getTaskDescriptor(request: Record<string, unknown>): Record<string, unknown> {
  // Descriptor is a named record inside the fixed task envelope.
  return getTask(request).descriptor as Record<string, unknown>;
}

/** Returns the Task root from a request Fixture. */
function getTaskRoot(request: Record<string, unknown>): Record<string, unknown> {
  const document = getTask(request).document as Record<string, unknown>;
  // The representative document always has one named root record.
  return document.root as Record<string, unknown>;
}

/** Returns the nested conversation input node. */
function getConversationInput(request: Record<string, unknown>): Record<string, unknown> {
  const rootChildren = getTaskRoot(request).children as Record<string, unknown>[];
  const section = getRecordAt(rootChildren, 0, "root child");
  const sectionChildren = section.children as Record<string, unknown>[];
  // The conversation input is the first child of the fixed section.
  return getRecordAt(sectionChildren, 0, "section child");
}

/** Returns the input MessageDocument from the typed Task leaf. */
function getInputMessages(request: Record<string, unknown>): Record<string, unknown> {
  // The fixed conversation leaf always stores a named messages record.
  return getConversationInput(request).messages as Record<string, unknown>;
}

/** Returns the first text content record from the fixed Message topology. */
function getFirstContent(request: Record<string, unknown>): Record<string, unknown> {
  const messages = getInputMessages(request);
  const root = messages.root as Record<string, unknown>;
  const entries = root.children as Record<string, unknown>[];
  const entry = getRecordAt(entries, 0, "message root child");
  const content = entry.content as Record<string, unknown>[];
  return getRecordAt(content, 0, "message content");
}

/** Returns the generation parameter record from the fixed Task section. */
function getGenerationParameters(request: Record<string, unknown>): Record<string, unknown> {
  const rootChildren = getTaskRoot(request).children as Record<string, unknown>[];
  const section = getRecordAt(rootChildren, 0, "root child");
  const sectionChildren = section.children as Record<string, unknown>[];
  const generation = getRecordAt(sectionChildren, 1, "section child");
  return generation.parameters as Record<string, unknown>;
}

/** Returns one required record at a known Fixture position. */
function getRecordAt(
  values: readonly Record<string, unknown>[],
  index: number,
  context: string,
): Record<string, unknown> {
  const value = values[index];
  // Missing topology is a broken test Fixture, not a Schema validation outcome.
  if (value === undefined) {
    throw new Error(`Missing ${context} at index ${String(index)}.`);
  }
  return value;
}
