// Copyright © 2026 Mcont.

import { beforeAll, describe, expect, it } from "vitest";

import { loadSchemaById } from "../schema-loader.js";
import { SchemaValidatorAdapter } from "../schema-validator-adapter.js";

/** Stable identifier of the self-contained ModelOutput Schema. */
const modelOutputSchemaId = "https://schemas.evolutos.com/mconet/model/output";

/** Existing Schema IDs used to detect embedded-contract drift. */
const modelTargetSchemaId = "https://schemas.evolutos.com/mconet/model/target";
const modelDescriptorSchemaId = "https://schemas.evolutos.com/mconet/model/descriptor";
const taskDocumentSchemaId = "https://schemas.evolutos.com/mconet/task/document";
const messageDocumentSchemaId = "https://schemas.evolutos.com/mconet/message/document";
const artifactCatalogSchemaId = "https://schemas.evolutos.com/mconet/artifact/catalog";

/** Loaded output Schema and independently published component Schemas. */
let modelOutputSchema: Readonly<Record<string, unknown>>;
let modelTargetSchema: Readonly<Record<string, unknown>>;
let modelDescriptorSchema: Readonly<Record<string, unknown>>;
let taskDocumentSchema: Readonly<Record<string, unknown>>;
let messageDocumentSchema: Readonly<Record<string, unknown>>;
let artifactCatalogSchema: Readonly<Record<string, unknown>>;

/** Strict compiled validator reused by all ModelOutput cases. */
let schemaValidator: SchemaValidatorAdapter;

beforeAll(async () => {
  // Registry loading makes exact IDs, duplicate detection, deep freezing, and
  // strict draft compilation part of every conformance assertion below.
  [
    modelOutputSchema,
    modelTargetSchema,
    modelDescriptorSchema,
    taskDocumentSchema,
    messageDocumentSchema,
    artifactCatalogSchema,
  ] = await Promise.all([
    loadSchemaById(modelOutputSchemaId),
    loadSchemaById(modelTargetSchemaId),
    loadSchemaById(modelDescriptorSchemaId),
    loadSchemaById(taskDocumentSchemaId),
    loadSchemaById(messageDocumentSchemaId),
    loadSchemaById(artifactCatalogSchemaId),
  ]);
  schemaValidator = new SchemaValidatorAdapter(modelOutputSchema);
});

describe("ModelOutput Schema", () => {
  // Envelope identity, ownership, concrete conversation results, open task
  // results, portable nested values, semantic boundaries, and immutability form
  // one standalone output acceptance contract.
  it("declares the stable identity and exact assembled output envelope", () => {
    const properties = modelOutputSchema.properties as Record<string, unknown>;

    // Exact field membership prevents request access, transport objects, text
    // shortcuts, or interaction controls from crossing Runtime assembly.
    expect(modelOutputSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(modelOutputSchema.$id).toBe(modelOutputSchemaId);
    expect(Object.keys(properties)).toEqual([
      "id",
      "target",
      "resolvedModel",
      "status",
      "result",
      "stopReason",
      "usage",
      "diagnostics",
      "protocolState",
      "extensions",
    ]);
    expect(modelOutputSchema.required).toEqual([
      "target",
      "status",
      "result",
      "diagnostics",
      "protocolState",
      "extensions",
    ]);
    expect(modelOutputSchema.additionalProperties).toBe(true);
    expect(Object.isFrozen(modelOutputSchema)).toBe(true);
  });

  it("keeps embedded public component surfaces aligned", () => {
    const definitions = getDefinitions(modelOutputSchema);
    const embeddedTarget = definitions.modelTarget as Record<string, unknown>;
    const embeddedTaskDocument = definitions.taskDocument as Record<string, unknown>;
    const embeddedCatalog = definitions.artifactCatalog as Record<string, unknown>;

    // Compare the contract-bearing surface while allowing local descriptions
    // and output-specific narrowing within the self-contained Schema resource.
    expect(Object.keys(embeddedTarget.properties as Record<string, unknown>)).toEqual(
      Object.keys(modelTargetSchema.properties as Record<string, unknown>),
    );
    expect(embeddedTarget.required).toEqual(modelTargetSchema.required);
    expect(embeddedTarget.additionalProperties).toBe(modelTargetSchema.additionalProperties);
    expect(embeddedTaskDocument.required).toEqual(taskDocumentSchema.required);
    expect(embeddedTaskDocument.additionalProperties).toBe(taskDocumentSchema.additionalProperties);
    expect(embeddedCatalog.required).toEqual(artifactCatalogSchema.required);
    expect(embeddedCatalog.additionalProperties).toBe(artifactCatalogSchema.additionalProperties);
  });

  it("keeps composed validation rules aligned after removing resource annotations", () => {
    const outputDefinitions = getDefinitions(modelOutputSchema);
    const composedSchemas = [
      [modelTargetSchema, "modelTarget"],
      [modelDescriptorSchema, "modelDescriptor"],
      [taskDocumentSchema, "taskDocument"],
      [artifactCatalogSchema, "artifactCatalog"],
    ] as const;

    // Resource identity, titles, comments, and descriptions are annotations.
    // Removing only those values leaves the complete executable validation shape.
    for (const [sourceSchema, embeddedName] of composedSchemas) {
      expect(getValidationShape(outputDefinitions[embeddedName])).toEqual(
        getValidationShape(sourceSchema),
      );
    }

    // Every reusable definition from the generic Task, Message, Artifact, and
    // Model contracts must retain equivalent validation behavior when embedded.
    for (const sourceSchema of [
      taskDocumentSchema,
      messageDocumentSchema,
      artifactCatalogSchema,
      modelDescriptorSchema,
    ]) {
      for (const [definitionName, definition] of Object.entries(getDefinitions(sourceSchema))) {
        expect(getValidationShape(outputDefinitions[definitionName])).toEqual(
          getValidationShape(definition),
        );
      }
    }
  });

  it("keeps shared identifier and recursive JSON definitions aligned", () => {
    const definitions = getDefinitions(modelOutputSchema);
    const descriptorDefinitions = getDefinitions(modelDescriptorSchema);

    // Whole-definition equality prevents the repeated portable grammar from
    // drifting between independently compiled language-neutral resources.
    for (const definitionName of [
      "openIdentifier",
      "jsonPrimitive",
      "jsonValue",
      "jsonRecord",
    ] as const) {
      expect(definitions[definitionName]).toEqual(descriptorDefinitions[definitionName]);
    }
  });

  it("defines explicit output fact and result-union contracts", () => {
    const definitions = getDefinitions(modelOutputSchema);
    const result = definitions.modelTaskResult as Record<string, unknown>;
    const usage = definitions.tokenUsage as Record<string, unknown>;
    const diagnostic = definitions.diagnostic as Record<string, unknown>;
    const protocolState = definitions.protocolState as Record<string, unknown>;

    // The standard task cannot fall through the open branch, and independently
    // owned output facts retain their own required-member rules.
    expect(result.oneOf).toEqual([
      { $ref: "#/$defs/conversationTaskResult" },
      { $ref: "#/$defs/openModelTaskResult" },
    ]);
    expect(usage.required).toEqual(["extensions"]);
    expect(diagnostic.required).toEqual(["code", "severity", "phase", "message"]);
    expect(protocolState.required).toEqual(["serviceId", "protocolId", "stateType", "stateValue"]);
  });

  it("accepts the smallest complete conversation output", () => {
    const output = createConversationOutput();

    // Optional protocol facts remain truly absent; required empty collections
    // and extension maps remain concrete values owned by the output envelope.
    expect(schemaValidator.validate(output)).toBe(true);
    expect(Object.hasOwn(output, "id")).toBe(false);
    expect(Object.hasOwn(output, "resolvedModel")).toBe(false);
    expect(Object.hasOwn(output, "stopReason")).toBe(false);
    expect(Object.hasOwn(output, "usage")).toBe(false);
  });

  it("accepts every assembled owner without conflating their identities", () => {
    const output = createConversationOutput();
    output.id = "output-7";
    output.resolvedModel = {
      name: "actual-model",
      displayName: "Actual Model",
      family: "family.text",
      version: "2026-10",
      metadata: { region: "east" },
      extensions: { "vendor.alias": "stable" },
    };
    output.status = "requires_action";
    output.stopReason = "provider.tool_calls";
    output.usage = {
      inputTokens: 11,
      outputTokens: 7,
      totalTokens: 25,
      extensions: { cachedInputTokens: 3 },
    };
    output.diagnostics = [
      {
        code: "response_warning",
        severity: "warning",
        phase: "response_parsing",
        message: "Provider returned a warning.",
        path: "/result/messages",
        serviceId: "service.vendor",
        details: { retryable: false },
      },
    ];
    output.protocolState = [
      {
        serviceId: "service.vendor",
        protocolId: "protocol.compatible",
        stateType: "state.cursor",
        stateValue: { cursor: "next-2" },
      },
      {
        serviceId: "service.vendor",
        protocolId: "protocol.compatible",
        stateType: "state.empty",
        stateValue: null,
      },
    ];
    output.extensions = { "vendor.response_id": "response-9" };

    // Exact independent values prove requested target, resolved model, Runtime
    // diagnostics, service state, usage, and extensions can coexist.
    expect(schemaValidator.validate(output)).toBe(true);
  });

  it("accepts an integration-defined task result and result-local Artifact", () => {
    const output = createOpenOutput();

    // Open task identity and unknown Task leaf data remain available without a
    // Core registry, while the Artifact stays inside the result-local Catalog.
    expect(schemaValidator.validate(output)).toBe(true);
  });

  it.each([
    {
      label: "missing retained target",
      mutate: (output: Record<string, unknown>) => {
        // Runtime must always restore the exact originating request target.
        Reflect.deleteProperty(output, "target");
      },
    },
    {
      label: "missing output status",
      mutate: (output: Record<string, unknown>) => {
        // Result contents cannot imply or synthesize the output status.
        Reflect.deleteProperty(output, "status");
      },
    },
    {
      label: "invalid open status",
      mutate: (output: Record<string, unknown>) => {
        // Status uses the shared open-identifier grammar without normalization.
        output.status = "invalid status";
      },
    },
    {
      label: "malformed resolved model",
      mutate: (output: Record<string, unknown>) => {
        // A reported model remains absent or complete and is never inferred.
        output.resolvedModel = { name: "actual-model" };
      },
    },
    {
      label: "negative token count",
      mutate: (output: Record<string, unknown>) => {
        // Provider accounting must use canonical non-negative safe integers.
        output.usage = { inputTokens: -1, extensions: {} };
      },
    },
    {
      label: "invalid diagnostic severity",
      mutate: (output: Record<string, unknown>) => {
        // Severity is the only intentionally closed diagnostic vocabulary.
        output.diagnostics = [
          {
            code: "bad_severity",
            severity: "fatal",
            phase: "validation",
            message: "Invalid severity.",
          },
        ];
      },
    },
    {
      label: "protocol state without value",
      mutate: (output: Record<string, unknown>) => {
        // Presence differs from JSON null for an opaque protocol state value.
        output.protocolState = [
          {
            serviceId: "service.vendor",
            protocolId: "protocol.compatible",
            stateType: "state.cursor",
          },
        ];
      },
    },
    {
      label: "non-JSON diagnostic details",
      mutate: (output: Record<string, unknown>) => {
        // Diagnostic serialization cannot carry behavior or platform objects.
        output.diagnostics = [
          {
            code: "bad_details",
            severity: "error",
            phase: "validation",
            message: "Invalid details.",
            details: () => undefined,
          },
        ];
      },
    },
  ])("rejects $label", ({ mutate }) => {
    const output = createConversationOutput();

    // One isolated mutation per case makes each failure attributable to a
    // single assembled owner instead of accidental shared fixture state.
    mutate(output);
    expect(schemaValidator.validate(output)).toBe(false);
  });

  it.each([
    {
      label: "conversation result without messages",
      mutate: (result: Record<string, unknown>) => {
        // The concrete result cannot be reconstructed from its generic document.
        Reflect.deleteProperty(result, "messages");
      },
    },
    {
      label: "conversation messages with input purpose",
      mutate: (result: Record<string, unknown>) => {
        // Current conversation results carry exact output-purpose messages.
        getMessages(result).purpose = "input";
      },
    },
    {
      label: "conversation messages with unknown content",
      mutate: (result: Record<string, unknown>) => {
        // The current output range is text-only even though generic Message
        // storage remains forward compatible elsewhere.
        const content = getFirstContent(result);
        content.kind = "provider.image";
        Reflect.deleteProperty(content, "text");
      },
    },
    {
      label: "conversation descriptor disguised as an open result",
      mutate: (result: Record<string, unknown>) => {
        // Removing messages cannot make the standard task use the open branch.
        Reflect.deleteProperty(result, "messages");
        getDescriptor(result).type = "conversation.generate";
      },
    },
  ])("rejects malformed $label", ({ mutate }) => {
    const output = createConversationOutput();
    const result = output.result as Record<string, unknown>;

    // The open-result branch explicitly excludes the standard conversation type,
    // preventing malformed standard data from bypassing its concrete contract.
    mutate(result);
    expect(schemaValidator.validate(output)).toBe(false);
  });

  it("leaves graph and Catalog identity semantics to dedicated validators", () => {
    const output = createOpenOutput();
    const result = output.result as Record<string, unknown>;
    const document = result.document as Record<string, unknown>;
    const root = document.root as Record<string, unknown>;
    const duplicateNode = createUnknownTaskNode("duplicate-node");
    duplicateNode.relations = [
      {
        sourceId: "duplicate-node",
        targetId: "missing-node",
        type: "task.references",
        metadata: {},
      },
    ];
    root.children = [duplicateNode, structuredClone(duplicateNode)];
    const artifacts = (result.artifacts as Record<string, unknown>).artifacts as unknown[];
    artifacts.push(structuredClone(artifacts[0]));

    // Recursive JSON Schema cannot maintain document-wide ID indexes or resolve
    // relation targets. Preserving all evidence lets existing domain validators
    // produce stable duplicate and unresolved-reference failures later.
    expect(schemaValidator.validate(output)).toBe(true);
  });

  it("preserves unknown fields and never mutates accepted output data", () => {
    const output = createConversationOutput();
    output.futureTopLevel = { enabled: true };
    const result = output.result as Record<string, unknown>;
    result.futureResultField = ["preserved"];
    const before = structuredClone(output);

    // Open extension by shape and non-destructive validation retain future data
    // without promoting it into a known owner or changing collection order.
    expect(schemaValidator.validate(output)).toBe(true);
    expect(output).toEqual(before);
    expect(output.futureTopLevel).toEqual({ enabled: true });
    expect(result.futureResultField).toEqual(["preserved"]);
  });
});

/** Returns a Schema's required local definition registry. */
function getDefinitions(schema: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const definitions = schema.$defs;
  if (definitions === null || typeof definitions !== "object" || Array.isArray(definitions)) {
    // A malformed committed Schema is a test setup failure, not an empty map.
    throw new TypeError("Schema definitions must be an object.");
  }
  return definitions as Record<string, unknown>;
}

/** Removes non-validating Schema annotations and resource-local definitions. */
function getValidationShape(value: unknown): unknown {
  if (Array.isArray(value)) {
    // Preserve ordered keyword arrays while recursively stripping annotations.
    return value.map((item) => getValidationShape(item));
  }
  if (value === null || typeof value !== "object") {
    return value;
  }

  const annotations = new Set(["$schema", "$id", "$defs", "title", "description", "$comment"]);
  const entries = Object.entries(value).flatMap(([key, member]) => {
    // Resource annotations and the source resource's definition registry do not
    // participate in the executable shape of one embedded root or definition.
    return annotations.has(key) ? [] : [[key, getValidationShape(member)] as const];
  });
  return Object.fromEntries(entries);
}

/** Creates the smallest complete assembled conversation output. */
function createConversationOutput(): Record<string, unknown> {
  // Every required collection and map is explicit so optional absence remains
  // observable and no Schema default can conceal ownership mistakes.
  return {
    target: createTarget(),
    status: "completed",
    result: createConversationResult(),
    diagnostics: [],
    protocolState: [],
    extensions: {},
  };
}

/** Creates a complete assembled output for an integration-defined task. */
function createOpenOutput(): Record<string, unknown> {
  // The unknown leaf and Artifact prove generic result data remains structural,
  // task-neutral, and scoped below result rather than promoted to ModelOutput.
  return {
    target: createTarget(),
    status: "vendor.awaiting_review",
    result: {
      descriptor: {
        type: "vendor.future_result",
        version: "2",
        outputSchemaId: "schema.vendor.output",
        metadata: { owner: "vendor" },
        extensions: { "vendor.descriptor": true },
      },
      document: createTaskDocument([createUnknownTaskNode("provider-result")]),
      artifacts: {
        artifacts: [
          {
            id: "artifact-1",
            kind: { id: "artifact.file", extensions: {} },
            mediaType: "application/json",
            source: { kind: "vendor.object_store", objectKey: "objects/result" },
            metadata: {},
            extensions: {},
          },
        ],
      },
      metadata: {},
      extensions: {},
    },
    diagnostics: [],
    protocolState: [],
    extensions: {},
  };
}

/** Creates one request-retained model target. */
function createTarget(): Record<string, unknown> {
  // Requested model identity remains separate from optional resolvedModel facts.
  return {
    serviceId: "service.vendor",
    protocolId: "protocol.compatible",
    model: { name: "requested-model", metadata: {}, extensions: {} },
    deploymentId: "production-a",
    extensions: { "vendor.routing": "east" },
  };
}

/** Creates one standard conversation task result with output messages. */
function createConversationResult(): Record<string, unknown> {
  // The generic TaskDocument and concrete MessageDocument remain independent;
  // message text is never flattened into the result or output envelope.
  return {
    descriptor: { type: "conversation.generate", metadata: {}, extensions: {} },
    document: createTaskDocument(),
    messages: createOutputMessages(),
    artifacts: { artifacts: [] },
    metadata: { providerRequestId: "request-7" },
    extensions: {},
  };
}

/** Creates one complete generic TaskDocument result tree. */
function createTaskDocument(
  children: readonly Record<string, unknown>[] = [],
): Record<string, unknown> {
  // Fresh arrays and maps isolate every caller from fixture mutation.
  return {
    version: "1.0",
    root: {
      id: "result-root",
      kind: "task.root",
      composition: "container",
      children: [...children],
      relations: [],
      metadata: {},
      extensions: {},
    },
    metadata: {},
    extensions: {},
  };
}

/** Creates one output-purpose text MessageDocument with nested group order. */
function createOutputMessages(): Record<string, unknown> {
  // Two ordered text segments ensure the Schema preserves content granularity
  // for the later conversation projection instead of accepting a text shortcut.
  return {
    version: "1.0",
    purpose: "output",
    root: {
      id: "messages",
      kind: "message.root",
      composition: "container",
      children: [
        {
          id: "assistant-group",
          kind: "message.group",
          composition: "container",
          children: [
            {
              id: "assistant-entry",
              kind: "message.entry",
              role: { id: "assistant", extensions: {} },
              content: [
                {
                  id: "content-1",
                  kind: "content.text",
                  text: "你好，",
                  metadata: {},
                  extensions: {},
                },
                {
                  id: "content-2",
                  kind: "content.text",
                  text: "世界。",
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
      ],
      relations: [],
      metadata: {},
      extensions: {},
    },
    metadata: {},
    extensions: {},
  };
}

/** Creates one forward-compatible unknown Task leaf. */
function createUnknownTaskNode(id: string): Record<string, unknown> {
  // Raw provider data is JSON-compatible here; binary carrier limits remain a
  // Runtime responsibility outside structural Schema validation.
  return {
    id,
    kind: "vendor.result",
    composition: "leaf",
    raw: { bytes: { score: 0.98 }, truncated: false, metadata: {} },
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Returns the mutable descriptor fixture nested in one result. */
function getDescriptor(result: Record<string, unknown>): Record<string, unknown> {
  // Test fixtures always create a named descriptor record before mutation.
  return result.descriptor as Record<string, unknown>;
}

/** Returns the mutable output MessageDocument nested in one result. */
function getMessages(result: Record<string, unknown>): Record<string, unknown> {
  // Standard conversation fixtures always own one complete messages record.
  return result.messages as Record<string, unknown>;
}

/** Returns the first mutable content segment from the nested output tree. */
function getFirstContent(result: Record<string, unknown>): Record<string, unknown> {
  const messages = getMessages(result);
  const root = messages.root as Record<string, unknown>;
  const rootChildren = root.children as Record<string, unknown>[];
  const groupChildren = rootChildren[0]?.children as Record<string, unknown>[];
  const content = groupChildren[0]?.content as Record<string, unknown>[];

  // The fixture constructor guarantees one group, entry, and content segment;
  // explicit failure keeps malformed test setup distinct from Schema rejection.
  if (content[0] === undefined) {
    throw new TypeError("Conversation output fixture must contain text content.");
  }
  return content[0];
}
