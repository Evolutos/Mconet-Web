// Copyright © 2026 Mcont.

import { beforeAll, describe, expect, it } from "vitest";

import { isGenerationParameters } from "../../packages/core-domain/src/generation-parameters.js";
import { isTaskDocument } from "../../packages/core-domain/src/task-document.js";
import { loadSchemaById } from "../schema-loader.js";
import { SchemaValidatorAdapter } from "../schema-validator-adapter.js";

/** Stable identifier of the self-contained TaskDocument Schema. */
const taskDocumentSchemaId = "https://schemas.evolutos.com/mconet/task/document";

/** Existing Schema supplying independently reviewed shared definitions. */
const modelDescriptorSchemaId = "https://schemas.evolutos.com/mconet/model/descriptor";

/** TaskDocument Schema loaded from the committed registry. */
let taskDocumentSchema: Readonly<Record<string, unknown>>;

/** Existing Schema used to detect shared-definition drift. */
let modelDescriptorSchema: Readonly<Record<string, unknown>>;

/** Strict compiled validator reused across structural conformance cases. */
let schemaValidator: SchemaValidatorAdapter;

beforeAll(async () => {
  // Use the production loader so exact ID lookup, duplicate detection, deep
  // freezing, and strict draft compilation are part of this artifact's evidence.
  taskDocumentSchema = await loadSchemaById(taskDocumentSchemaId);
  modelDescriptorSchema = await loadSchemaById(modelDescriptorSchemaId);
  schemaValidator = new SchemaValidatorAdapter(taskDocumentSchema);
});

describe("TaskDocument Schema", () => {
  // Keep envelope shape, node variants, semantic boundaries, and mutation
  // behavior together as the acceptance surface of this single Schema.
  it("declares the stable identity and complete document envelope", () => {
    // Exact keywords prevent accidental dialect, identity, field, or forward-
    // compatibility policy drift that example Fixtures alone would not expose.
    expect(taskDocumentSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(taskDocumentSchema.$id).toBe(taskDocumentSchemaId);
    expect(taskDocumentSchema.required).toEqual(["version", "root", "metadata", "extensions"]);
    expect(Object.keys(taskDocumentSchema.properties as Record<string, unknown>)).toEqual([
      "version",
      "root",
      "metadata",
      "extensions",
    ]);
    expect(taskDocumentSchema.additionalProperties).toBe(true);
    expect(Object.isFrozen(taskDocumentSchema)).toBe(true);
  });

  it("keeps shared identifier and recursive JSON definitions aligned", () => {
    const taskDefinitions = taskDocumentSchema.$defs as Record<string, unknown>;
    const descriptorDefinitions = modelDescriptorSchema.$defs as Record<string, unknown>;

    // Whole-definition comparison keeps every self-contained Schema aligned on
    // Unicode identifier syntax and recursive portable JSON semantics.
    for (const definitionName of [
      "openIdentifier",
      "jsonPrimitive",
      "jsonValue",
      "jsonRecord",
    ] as const) {
      expect(taskDefinitions[definitionName]).toEqual(descriptorDefinitions[definitionName]);
    }
  });

  it("accepts a complete ordered Task Fixture in both structural contracts", () => {
    const fixture = createCompleteFixture();
    const root = fixture.root as Record<string, unknown>;
    const children = root.children as readonly unknown[];

    // The same Fixture covers nested groups, a MessageDocument, generation
    // storage, an unknown raw leaf, forward relations, Unicode, and open fields.
    expect(isTaskDocument(fixture)).toBe(true);
    expect(schemaValidator.validate(fixture)).toBe(true);
    expect((root.children as readonly unknown[])[0]).toBe(children[0]);
    expect((root.children as readonly unknown[])[1]).toBe(children[1]);
  });

  it.each([
    {
      label: "missing version",
      mutate: (fixture: Record<string, unknown>) => {
        // Remove one required envelope member without changing tree validity.
        Reflect.deleteProperty(fixture, "version");
      },
    },
    {
      label: "blank version",
      mutate: (fixture: Record<string, unknown>) => {
        // An opaque version still requires at least one visible character.
        fixture.version = " \t";
      },
    },
    {
      label: "ordinary group at the root",
      mutate: (fixture: Record<string, unknown>) => {
        // Only the exact task.root container can anchor a TaskDocument.
        getRoot(fixture).kind = "task.group";
      },
    },
    {
      label: "known conversation kind used by a container",
      mutate: (fixture: Record<string, unknown>) => {
        // Typed leaf identities cannot be reclassified as recursive groups.
        getInputGroup(fixture).kind = "task.input.conversation";
      },
    },
    {
      label: "conversation input without messages",
      mutate: (fixture: Record<string, unknown>) => {
        // The known input kind always carries one complete MessageDocument.
        Reflect.deleteProperty(getConversationInput(fixture), "messages");
      },
    },
    {
      label: "conversation input with output-purpose root mismatch",
      mutate: (fixture: Record<string, unknown>) => {
        const input = getConversationInput(fixture);
        const messages = input.messages as Record<string, unknown>;
        // Message root structure remains part of the nested Task shape.
        (messages.root as Record<string, unknown>).kind = "message.group";
      },
    },
    {
      label: "generation node without parameters",
      mutate: (fixture: Record<string, unknown>) => {
        // The known configuration kind cannot become an empty unknown leaf.
        Reflect.deleteProperty(getGenerationNode(fixture), "parameters");
      },
    },
    {
      label: "unknown leaf carrying known messages payload",
      mutate: (fixture: Record<string, unknown>) => {
        // Unknown leaves preserve only optional raw data, never typed payloads.
        getUnknownNode(fixture).messages = createMessageDocument();
      },
    },
    {
      label: "leaf carrying children",
      mutate: (fixture: Record<string, unknown>) => {
        // Composition is authoritative and leaf nodes cannot gain descendants.
        getUnknownNode(fixture).children = [];
      },
    },
    {
      label: "raw payload without truncation state",
      mutate: (fixture: Record<string, unknown>) => {
        const raw = getUnknownNode(fixture).raw as Record<string, unknown>;
        // Preserved bytes require an explicit completeness decision.
        Reflect.deleteProperty(raw, "truncated");
      },
    },
    {
      label: "invalid relation type identifier",
      mutate: (fixture: Record<string, unknown>) => {
        const relations = getRoot(fixture).relations as Record<string, unknown>[];
        // Relation classification follows the shared open-identifier grammar.
        getRecordAt(relations, 0, "root relation").type = "invalid relation";
      },
    },
    {
      label: "non-JSON document metadata",
      mutate: (fixture: Record<string, unknown>) => {
        // Portable metadata excludes executable host values.
        fixture.metadata = { callback: () => undefined };
      },
    },
  ])("rejects $label in both structural contracts", ({ mutate }) => {
    const fixture = createCompleteFixture();

    // Each case introduces exactly one local shape fault and uses a fresh tree,
    // preventing mutation leakage from masking Schema/runtime agreement.
    mutate(fixture);
    expect(isTaskDocument(fixture)).toBe(false);
    expect(schemaValidator.validate(fixture)).toBe(false);
  });

  it("leaves document-wide identity and relation resolution to Runtime", () => {
    const duplicateIdFixture = createCompleteFixture();
    const unresolvedRelationFixture = createCompleteFixture();

    // The duplicate lives in a different branch, so only the whole-document
    // index can detect it. JSON Schema cannot resolve arbitrary graph endpoints.
    getUnknownNode(duplicateIdFixture).id = getConversationInput(duplicateIdFixture).id;
    const relations = getRoot(unresolvedRelationFixture).relations as Record<string, unknown>[];
    getRecordAt(relations, 0, "root relation").targetId = "missing-node";

    expect(schemaValidator.validate(duplicateIdFixture)).toBe(true);
    expect(isTaskDocument(duplicateIdFixture)).toBe(false);
    expect(schemaValidator.validate(unresolvedRelationFixture)).toBe(true);
    expect(isTaskDocument(unresolvedRelationFixture)).toBe(false);
  });

  it("leaves generation value ranges to the dedicated validator", () => {
    const fixture = createCompleteFixture();
    const parameters = {
      temperature: -1,
      topP: 2,
      maxOutputTokens: 0,
      stop: [],
      seed: 1.5,
    };
    getGenerationNode(fixture).parameters = parameters;

    // TaskDocument owns serializable storage shape; executable generation ranges
    // are a later independent boundary and must not be duplicated in this Schema.
    expect(schemaValidator.validate(fixture)).toBe(true);
    expect(isTaskDocument(fixture)).toBe(true);
    expect(isGenerationParameters(parameters)).toBe(false);
  });

  it("does not mutate valid or invalid Fixture data", () => {
    const validFixture = createCompleteFixture();
    const invalidFixture = createCompleteFixture();
    getRoot(invalidFixture).kind = "task.group";
    const validBefore = structuredClone(validFixture);
    const invalidBefore = structuredClone(invalidFixture);

    // Ajv mutation options are disabled, so known and unknown fields, order,
    // Unicode, raw byte views, and invalid source values remain untouched.
    expect(schemaValidator.validate(validFixture)).toBe(true);
    expect(schemaValidator.validate(invalidFixture)).toBe(false);
    expect(validFixture).toEqual(validBefore);
    expect(invalidFixture).toEqual(invalidBefore);
  });
});

/** Creates one complete representative Task document without using Builders. */
function createCompleteFixture(): Record<string, unknown> {
  const conversationInput = createConversationInput();
  const generation = createGenerationNode();
  const unknown = createUnknownNode();

  // Separate branches make global identity checks distinguishable from direct
  // sibling rules while preserving deterministic preorder for future Fixtures.
  return {
    version: "1.0",
    root: {
      id: "task-root",
      kind: "task.root",
      composition: "container",
      children: [
        createGroup("input-section", [conversationInput, generation]),
        createGroup("future-section", [unknown]),
      ],
      relations: [
        {
          sourceId: "conversation-input",
          targetId: "future-node",
          type: "task.precedes",
          metadata: { weight: 0 },
        },
      ],
      metadata: { ordered: true },
      extensions: {},
    },
    metadata: { source: "schema-conformance" },
    extensions: { "provider.trace": { enabled: false } },
    futureDocumentField: { retained: true },
  };
}

/** Creates one ordered Task group around caller-selected children. */
function createGroup(id: string, children: readonly Record<string, unknown>[]) {
  // Every shared node field is explicit so local mutation cases stay isolated.
  return {
    id,
    kind: "task.group",
    composition: "container",
    children,
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Creates one typed conversation input leaf. */
function createConversationInput(): Record<string, unknown> {
  // Message structure remains nested and independently versioned.
  return {
    id: "conversation-input",
    kind: "task.input.conversation",
    composition: "leaf",
    messages: createMessageDocument(),
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Creates one typed generation-configuration leaf. */
function createGenerationNode(): Record<string, unknown> {
  // Valid ranges keep the representative Fixture usable at later boundaries.
  return {
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
}

/** Creates one preserved integration-defined leaf with bounded raw data. */
function createUnknownNode(): Record<string, unknown> {
  // Raw bytes remain an opaque runtime carrier; Schema checks surrounding state.
  return {
    id: "future-node",
    kind: "provider.future_task",
    composition: "leaf",
    raw: {
      mediaType: "application/octet-stream",
      schemaId: "provider.future.v1",
      bytes: new Uint8Array([0, 127, 255]),
      truncated: false,
      metadata: { retained: true },
    },
    relations: [],
    metadata: {},
    extensions: { "provider.mode": "opaque" },
  };
}

/** Creates one complete text-only MessageDocument for conversation input. */
function createMessageDocument(): Record<string, unknown> {
  // Unicode and an open role prove the nested self-contained Message definitions.
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
              id: "content-user",
              kind: "content.text",
              text: "你好，Mconet 👋",
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

/** Returns the Task root from the fixed representative Fixture. */
function getRoot(fixture: Record<string, unknown>): Record<string, unknown> {
  // Fixtures created above always store a named root record.
  return fixture.root as Record<string, unknown>;
}

/** Returns the first nested input-section group. */
function getInputGroup(fixture: Record<string, unknown>): Record<string, unknown> {
  const children = getRoot(fixture).children as Record<string, unknown>[];
  // Fixed topology makes index zero the input section in every fresh Fixture.
  return getRecordAt(children, 0, "root child");
}

/** Returns the typed conversation input from the input section. */
function getConversationInput(fixture: Record<string, unknown>): Record<string, unknown> {
  const children = getInputGroup(fixture).children as Record<string, unknown>[];
  // Fixed topology makes index zero the conversation input.
  return getRecordAt(children, 0, "input-section child");
}

/** Returns the generation node from the input section. */
function getGenerationNode(fixture: Record<string, unknown>): Record<string, unknown> {
  const children = getInputGroup(fixture).children as Record<string, unknown>[];
  // Fixed topology makes index one the generation configuration.
  return getRecordAt(children, 1, "input-section child");
}

/** Returns the unknown leaf from the separate future section. */
function getUnknownNode(fixture: Record<string, unknown>): Record<string, unknown> {
  const rootChildren = getRoot(fixture).children as Record<string, unknown>[];
  const futureGroup = getRecordAt(rootChildren, 1, "root child");
  const futureChildren = futureGroup.children as Record<string, unknown>[];
  // The future section contains exactly one preserved unknown leaf.
  return getRecordAt(futureChildren, 0, "future-section child");
}

/** Returns one required record at a known Fixture position. */
function getRecordAt(
  values: readonly Record<string, unknown>[],
  index: number,
  context: string,
): Record<string, unknown> {
  const value = values[index];
  // A missing helper value indicates a broken test Fixture rather than a Schema
  // result, so fail immediately with the local topology context.
  if (value === undefined) {
    throw new Error(`Missing ${context} at index ${String(index)}.`);
  }
  return value;
}
