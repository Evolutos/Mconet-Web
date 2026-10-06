// Copyright © 2026 Mcont.

import { beforeAll, describe, expect, it } from "vitest";

import { isMessageDocument } from "../../packages/core-domain/src/message-document.js";
import { loadSchemaById } from "../schema-loader.js";
import { SchemaValidatorAdapter } from "../schema-validator-adapter.js";

/** Stable identifier of the self-contained MessageDocument Schema. */
const messageDocumentSchemaId = "https://schemas.evolutos.com/mconet/message/document";

/** Existing Schema supplying independently reviewed shared definitions. */
const modelDescriptorSchemaId = "https://schemas.evolutos.com/mconet/model/descriptor";

/** MessageDocument Schema loaded from the committed registry. */
let messageDocumentSchema: Readonly<Record<string, unknown>>;

/** Existing Schema used to detect drift in shared portable definitions. */
let modelDescriptorSchema: Readonly<Record<string, unknown>>;

/** Strict compiled validator reused by every structural conformance case. */
let schemaValidator: SchemaValidatorAdapter;

beforeAll(async () => {
  // Resolve both documents through the production loader so registry identity,
  // deep freezing, and strict draft compilation are exercised before fixtures.
  messageDocumentSchema = await loadSchemaById(messageDocumentSchemaId);
  modelDescriptorSchema = await loadSchemaById(modelDescriptorSchemaId);
  schemaValidator = new SchemaValidatorAdapter(messageDocumentSchema);
});

describe("MessageDocument Schema", () => {
  // Keep structural, runtime-agreement, semantic-boundary, and mutation checks
  // together as the complete acceptance surface for this one Schema artifact.
  it("declares the stable identity and complete document envelope", () => {
    // Exact keyword values expose accidental identity, required-member, or
    // forward-compatibility policy drift independently from example fixtures.
    expect(messageDocumentSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(messageDocumentSchema.$id).toBe(messageDocumentSchemaId);
    expect(messageDocumentSchema.required).toEqual([
      "version",
      "purpose",
      "root",
      "metadata",
      "extensions",
    ]);
    expect(Object.keys(messageDocumentSchema.properties as Record<string, unknown>)).toEqual([
      "version",
      "purpose",
      "root",
      "metadata",
      "extensions",
    ]);
    expect(messageDocumentSchema.additionalProperties).toBe(true);
    expect(Object.isFrozen(messageDocumentSchema)).toBe(true);
  });

  it("keeps shared identifier and recursive JSON definitions aligned", () => {
    const messageDefinitions = messageDocumentSchema.$defs as Record<string, unknown>;
    const descriptorDefinitions = modelDescriptorSchema.$defs as Record<string, unknown>;

    // Whole-definition comparison prevents a local Message copy from silently
    // changing Unicode identifier syntax or recursive JSON value semantics.
    for (const definitionName of [
      "openIdentifier",
      "jsonPrimitive",
      "jsonValue",
      "jsonRecord",
    ] as const) {
      expect(messageDefinitions[definitionName]).toEqual(descriptorDefinitions[definitionName]);
    }
  });

  it("accepts one complete ordered Message Fixture in both contracts", () => {
    const fixture = createCompleteFixture();
    const root = fixture.root as Record<string, unknown>;
    const children = root.children as readonly unknown[];

    // The same in-memory Fixture covers nested groups, an integration role,
    // Unicode text, unknown content with raw bytes, and a forward relation.
    expect(isMessageDocument(fixture)).toBe(true);
    expect(schemaValidator.validate(fixture)).toBe(true);

    // Validation observes ordering and identity without rebuilding collections.
    expect((root.children as readonly unknown[])[0]).toBe(children[0]);
    expect((root.children as readonly unknown[])[1]).toBe(children[1]);
  });

  it.each([
    {
      label: "missing version",
      mutate: (fixture: Record<string, unknown>) => {
        // Remove exactly one required envelope member for this case.
        Reflect.deleteProperty(fixture, "version");
      },
    },
    {
      label: "blank version",
      mutate: (fixture: Record<string, unknown>) => {
        // A whitespace-only opaque version carries no usable version identity.
        fixture.version = " \t";
      },
    },
    {
      label: "invalid purpose identifier",
      mutate: (fixture: Record<string, unknown>) => {
        // Purpose follows the same open-identifier grammar as other identities.
        fixture.purpose = "invalid purpose";
      },
    },
    {
      label: "ordinary group at the root",
      mutate: (fixture: Record<string, unknown>) => {
        // Only the exact root kind may anchor the document traversal.
        (fixture.root as Record<string, unknown>).kind = "message.group";
      },
    },
    {
      label: "children carried by an entry",
      mutate: (fixture: Record<string, unknown>) => {
        // The first nested child is a leaf entry and cannot become a container.
        getFirstEntry(fixture).children = [];
      },
    },
    {
      label: "empty entry content",
      mutate: (fixture: Record<string, unknown>) => {
        // Every leaf must carry at least one ordered content value.
        getFirstEntry(fixture).content = [];
      },
    },
    {
      label: "text content without text",
      mutate: (fixture: Record<string, unknown>) => {
        const content = getFirstEntry(fixture).content as Record<string, unknown>[];
        // The standard text kind selects the concrete required text payload.
        Reflect.deleteProperty(getRecordAt(content, 0, "first entry content"), "text");
      },
    },
    {
      label: "raw payload without truncation state",
      mutate: (fixture: Record<string, unknown>) => {
        const content = getSecondEntry(fixture).content as Record<string, unknown>[];
        const raw = getRecordAt(content, 0, "second entry content").raw as Record<string, unknown>;
        // Present raw bytes require an explicit source-completeness decision.
        Reflect.deleteProperty(raw, "truncated");
      },
    },
    {
      label: "element-shaped content",
      mutate: (fixture: Record<string, unknown>) => {
        const content = getFirstEntry(fixture).content as Record<string, unknown>[];
        // Reserved tree fields cannot turn an entry-owned content value into an element.
        getRecordAt(content, 0, "first entry content").children = [];
      },
    },
    {
      label: "invalid relation endpoint identifier",
      mutate: (fixture: Record<string, unknown>) => {
        const relations = getFirstEntry(fixture).relations as Record<string, unknown>[];
        // Endpoint syntax is structural even though endpoint existence is semantic.
        getRecordAt(relations, 0, "first entry relation").targetId = "invalid endpoint";
      },
    },
    {
      label: "non-JSON document metadata",
      mutate: (fixture: Record<string, unknown>) => {
        // Recursive metadata is portable JSON and therefore excludes functions.
        fixture.metadata = { callback: () => undefined };
      },
    },
  ])("rejects $label in both contracts", ({ mutate }) => {
    const fixture = createCompleteFixture();

    // Each fresh Fixture differs by one structural fault, keeping failures local
    // and proving Schema/runtime agreement without cross-case mutation leakage.
    mutate(fixture);
    expect(isMessageDocument(fixture)).toBe(false);
    expect(schemaValidator.validate(fixture)).toBe(false);
  });

  it("leaves graph-wide semantic invariants to the runtime validator", () => {
    const duplicateIdFixture = createCompleteFixture();
    const unresolvedRelationFixture = createCompleteFixture();

    // JSON Schema can validate each recursive node but cannot express one shared
    // ID namespace or resolve arbitrary relation endpoints across the full tree.
    getSecondEntry(duplicateIdFixture).id = getFirstEntry(duplicateIdFixture).id;
    const relations = getFirstEntry(unresolvedRelationFixture).relations as Record<
      string,
      unknown
    >[];
    getRecordAt(relations, 0, "first entry relation").targetId = "missing-entry";

    expect(schemaValidator.validate(duplicateIdFixture)).toBe(true);
    expect(isMessageDocument(duplicateIdFixture)).toBe(false);
    expect(schemaValidator.validate(unresolvedRelationFixture)).toBe(true);
    expect(isMessageDocument(unresolvedRelationFixture)).toBe(false);
  });

  it("does not mutate valid or invalid Fixture data", () => {
    const validFixture = createCompleteFixture();
    const invalidFixture = createCompleteFixture();
    invalidFixture.purpose = "invalid purpose";
    const originalValidFixture = structuredClone(validFixture);
    const originalInvalidFixture = structuredClone(invalidFixture);

    // Adapter mutation features are disabled, so validation preserves byte views,
    // order, unknown fields, explicit false values, and the invalid source value.
    expect(schemaValidator.validate(validFixture)).toBe(true);
    expect(schemaValidator.validate(invalidFixture)).toBe(false);
    expect(validFixture).toEqual(originalValidFixture);
    expect(invalidFixture).toEqual(originalInvalidFixture);
  });
});

/** Creates one complete representative document without a future Builder. */
function createCompleteFixture(): Record<string, unknown> {
  // Construct every required container explicitly so this Schema step remains
  // independent from later Entry and Document Builder implementations.
  const firstEntry = createEntry("entry-1", {
    id: "content-1",
    kind: "content.text",
    text: "你好，Mconet 👋\nsecond line",
    metadata: { language: "zh-CN" },
    extensions: {},
  });
  const secondEntry = createEntry("entry-2", {
    id: "content-2",
    kind: "provider.rich_text",
    raw: {
      mediaType: "application/octet-stream",
      schemaId: "provider.rich_text.v1",
      bytes: new Uint8Array([0, 127, 255]),
      truncated: false,
      metadata: { retained: true },
    },
    metadata: {},
    extensions: { "provider.display": { mode: "compact" } },
  });

  // A forward reference proves relation syntax is independent from child order;
  // endpoint resolution is separately asserted at the runtime semantic boundary.
  firstEntry.relations = [
    {
      sourceId: "entry-1",
      targetId: "entry-2",
      type: "message.precedes",
      metadata: { weight: 0 },
    },
  ];

  return {
    version: "1.0",
    purpose: "provider.review_context",
    root: {
      id: "root",
      kind: "message.root",
      composition: "container",
      children: [
        {
          id: "history",
          kind: "message.group",
          composition: "container",
          children: [firstEntry],
          relations: [],
          metadata: {},
          extensions: {},
        },
        secondEntry,
      ],
      relations: [],
      metadata: { turnCount: 2 },
      extensions: {},
    },
    metadata: { source: "schema-conformance" },
    extensions: { "provider.trace": { enabled: false } },
    futureDocumentField: { retained: true },
  };
}

/** Creates one complete leaf entry around caller-selected content. */
function createEntry(id: string, content: Record<string, unknown>): Record<string, unknown> {
  // Preserve the supplied content object and make every required leaf field
  // explicit so individual conformance mutations have one unambiguous target.
  return {
    id,
    kind: "message.entry",
    role: {
      id: id === "entry-1" ? "message.user" : "provider.reviewer",
      semantic: id === "entry-1" ? "user" : "reviewer",
      rawValue: id === "entry-1" ? "human" : "review-agent",
      extensions: {},
    },
    content: [content],
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Returns the first nested entry from the fixed representative topology. */
function getFirstEntry(fixture: Record<string, unknown>): Record<string, unknown> {
  // The helper is private to fixtures created above; indexed casts only navigate
  // that deliberately fixed topology and never validate untrusted production data.
  const root = fixture.root as Record<string, unknown>;
  const children = root.children as Record<string, unknown>[];
  const history = getRecordAt(children, 0, "root child");
  const historyChildren = history.children as Record<string, unknown>[];
  return getRecordAt(historyChildren, 0, "history child");
}

/** Returns the second entry from the fixed representative topology. */
function getSecondEntry(fixture: Record<string, unknown>): Record<string, unknown> {
  // Keep topology navigation in one helper so mutation cases cannot accidentally
  // depend on an unrelated field or duplicate unchecked indexing logic.
  const root = fixture.root as Record<string, unknown>;
  const children = root.children as Record<string, unknown>[];
  return getRecordAt(children, 1, "root child");
}

/** Returns one required record from a fixed test-fixture collection. */
function getRecordAt(
  records: readonly Record<string, unknown>[],
  index: number,
  context: string,
): Record<string, unknown> {
  const record = records[index];
  // Throwing identifies a broken fixture factory immediately instead of letting
  // a mutation case fail later with an unrelated undefined-property exception.
  if (record === undefined) {
    throw new Error(`Expected ${context} at index ${index}.`);
  }
  return record;
}
