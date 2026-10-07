// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ArtifactCatalog } from "./artifact-catalog.js";
import { ConversationTaskBuilder } from "./conversation-task-builder.js";
import type { ConversationTaskRequest } from "./conversation-task-request.js";
import type { Extensions } from "./extensions.js";
import type { GenerationParameters } from "./generation-parameters.js";
import type { JsonValue } from "./json-value.js";
import type { MessageDocument } from "./message-document.js";
import type { TaskDocument } from "./task-document.js";
import type { TaskNode } from "./task-node.js";

it("builds the same task-level value as direct construction", () => {
  const document = createTaskDocument();
  const artifacts: ArtifactCatalog = { artifacts: [] };
  const metadata = { locale: "zh-CN", turn: 2 } as const;
  const extensions = { "vendor.trace": { enabled: true } } as const;
  const builder = new ConversationTaskBuilder(document);
  const returned = builder
    .withArtifacts(artifacts)
    .withMetadata(metadata)
    .withExtensions(extensions);
  const built = builder.build();
  const direct: ConversationTaskRequest = {
    descriptor: { type: "conversation.generate", metadata: {}, extensions: {} },
    document,
    artifacts,
    metadata,
    extensions,
  };

  // Structural equality proves direct-construction equivalence. Identity checks
  // prove the Builder did not rebuild or reorder caller-owned domain values.
  expect(returned).toBe(builder);
  expect(built).toEqual(direct);
  expect(built.document).toBe(document);
  expect(built.artifacts).toBe(artifacts);
  expect(built.metadata).toBe(metadata);
  expect(built.extensions).toBe(extensions);
  expect(Object.isFrozen(built)).toBe(true);
});

it("returns fresh envelopes isolated from later fluent replacements", () => {
  const document = createTaskDocument();
  const firstArtifacts: ArtifactCatalog = { artifacts: [] };
  const secondArtifacts: ArtifactCatalog = { artifacts: [] };
  const firstMetadata = { turn: 1 } as const;
  const firstExtensions = { "vendor.mode": "initial" } as const;
  const builder = new ConversationTaskBuilder(document)
    .withArtifacts(firstArtifacts)
    .withMetadata(firstMetadata)
    .withExtensions(firstExtensions);
  const first = builder.build();

  builder
    .withArtifacts(secondArtifacts)
    .withMetadata({ turn: 2 })
    .withExtensions({ "vendor.mode": "later" });
  const second = builder.build();

  // Fluent changes affect only future snapshots; every build owns a new outer
  // object while retaining the same required TaskDocument reference.
  expect(first).not.toBe(second);
  expect(first.document).toBe(document);
  expect(second.document).toBe(document);
  expect(first.artifacts).toBe(firstArtifacts);
  expect(second.artifacts).toBe(secondArtifacts);
  expect(first.metadata).toBe(firstMetadata);
  expect(first.extensions).toBe(firstExtensions);
  expect(second.metadata).toEqual({ turn: 2 });
  expect(second.extensions).toEqual({ "vendor.mode": "later" });
});

it("gives independent builders distinct empty Artifact scopes", () => {
  const firstBuilder = new ConversationTaskBuilder(createTaskDocument());
  const secondBuilder = new ConversationTaskBuilder(createTaskDocument("second"));
  const first = firstBuilder.build();
  const second = secondBuilder.build();

  // Request-local default Catalog identity is not shared between construction
  // flows, while both immutable scopes remain explicitly and validly empty.
  expect(first.artifacts).not.toBe(second.artifacts);
  expect(first.artifacts.artifacts).toEqual([]);
  expect(second.artifacts.artifacts).toEqual([]);
  expect(Object.isFrozen(first.artifacts)).toBe(true);
  expect(Object.isFrozen(first.artifacts.artifacts)).toBe(true);
});

it("delegates complete request semantics to the existing validator", () => {
  const noConversationInput: TaskDocument = {
    ...createTaskDocument(),
    root: createTaskRoot([]),
  };
  const invalidMetadata = { invalid: Number.NaN } as Readonly<Record<string, JsonValue>>;
  const nonEmptyArtifacts = {
    artifacts: [
      {
        id: "artifact-1",
        kind: "artifact.binary",
        source: {
          type: "inline",
          bytes: new Uint8Array([1]),
          truncated: false,
          metadata: {},
        },
        metadata: {},
        extensions: {},
      },
    ],
  } as const satisfies ArtifactCatalog;

  // Different invalid domains fail through the same build boundary, showing the
  // Builder has no parallel input-cardinality, JSON, or Artifact support rules.
  expect(() => new ConversationTaskBuilder(noConversationInput).build()).toThrow(TypeError);
  expect(() =>
    new ConversationTaskBuilder(createTaskDocument()).withMetadata(invalidMetadata).build(),
  ).toThrow(TypeError);
  expect(() =>
    new ConversationTaskBuilder(createTaskDocument()).withArtifacts(nonEmptyArtifacts).build(),
  ).toThrow(TypeError);
});

it("does not mutate or freeze caller-owned nested values during build", () => {
  const document = createTaskDocument();
  const artifacts: ArtifactCatalog = { artifacts: [] };
  const metadata: Record<string, JsonValue> = { turn: 1 };
  const extensions: Extensions = { "vendor.mutable": true };
  const documentBefore = structuredClone(document);
  const built = new ConversationTaskBuilder(document)
    .withArtifacts(artifacts)
    .withMetadata(metadata)
    .withExtensions(extensions)
    .build();

  // Only the Builder-owned envelope is frozen. Direct-construction reference
  // semantics and every caller-owned object's existing mutability stay intact.
  expect(document).toEqual(documentBefore);
  expect(built.document).toBe(document);
  expect(Object.isFrozen(document)).toBe(false);
  expect(Object.isFrozen(artifacts)).toBe(false);
  expect(Object.isFrozen(metadata)).toBe(false);
  expect(Object.isFrozen(extensions)).toBe(false);
});

it("exposes only task-level fluent fields and the fixed descriptor", () => {
  const builder = new ConversationTaskBuilder(createTaskDocument());
  const request = builder.build();

  // Runtime outer-request concerns cannot enter this Builder, and the shared
  // descriptor cannot be reclassified or extended by a caller.
  expect(Object.keys(builder)).toEqual([]);
  expect(request.descriptor).toEqual({
    type: "conversation.generate",
    metadata: {},
    extensions: {},
  });
  expect(Object.isFrozen(request.descriptor)).toBe(true);
  expect("target" in request).toBe(false);
  expect("access" in request).toBe(false);
  expect("authorization" in request).toBe(false);
  expect("transport" in request).toBe(false);
});

it("has exact constructor and fluent method signatures", () => {
  // Type-level assertions prevent ModelRequest fields, protocol controls, or
  // alternate return shapes from expanding the public Builder surface.
  expectTypeOf(ConversationTaskBuilder).toBeConstructibleWith(createTaskDocument());
  expectTypeOf<ConversationTaskBuilder["withArtifacts"]>().toEqualTypeOf<
    (artifacts: ArtifactCatalog) => ConversationTaskBuilder
  >();
  expectTypeOf<ConversationTaskBuilder["withMetadata"]>().toEqualTypeOf<
    (metadata: Readonly<Record<string, JsonValue>>) => ConversationTaskBuilder
  >();
  expectTypeOf<ConversationTaskBuilder["withExtensions"]>().toEqualTypeOf<
    (extensions: Extensions) => ConversationTaskBuilder
  >();
  expectTypeOf<ConversationTaskBuilder["build"]>().toEqualTypeOf<() => ConversationTaskRequest>();
});

/** Creates one valid conversation TaskDocument with optional unique text. */
function createTaskDocument(text = "Hello 世界"): TaskDocument {
  const messages = createMessageDocument(text);
  const input: TaskNode = {
    id: "conversation-input",
    kind: "task.input.conversation",
    composition: "leaf",
    messages,
    relations: [],
    metadata: {},
    extensions: {},
  };
  const parameters: GenerationParameters = {
    temperature: 0.7,
    topP: 0.9,
    maxOutputTokens: 256,
    stop: ["done"],
    seed: 42,
  };
  const configuration: TaskNode = {
    id: "generation-parameters",
    kind: "task.configuration",
    composition: "leaf",
    parameters,
    relations: [],
    metadata: {},
    extensions: {},
  };

  // Child order is intentional and must cross the Builder unchanged.
  return {
    version: "1.0",
    root: createTaskRoot([input, configuration]),
    metadata: {},
    extensions: {},
  };
}

/** Creates the required Task root with a caller-selected ordered child list. */
function createTaskRoot(children: readonly TaskNode[]): TaskDocument["root"] {
  // The root is complete independently from the Builder and remains caller-owned.
  return {
    id: "task-root",
    kind: "task.root",
    composition: "container",
    children,
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Creates one valid text-only input MessageDocument. */
function createMessageDocument(text: string): MessageDocument {
  // A concrete user entry exercises the full nested request validator while
  // keeping Builder behavior independent from Message construction helpers.
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
              text,
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
