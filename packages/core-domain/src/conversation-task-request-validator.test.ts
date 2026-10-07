// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { Artifact } from "./artifact.js";
import type { ArtifactCatalog } from "./artifact-catalog.js";
import {
  isConversationTaskRequest,
  type ConversationTaskRequest,
} from "./conversation-task-request.js";
import type { GenerationParametersNode } from "./generation-parameters-node.js";
import type { MessageContent } from "./message-content.js";
import type { MessageDocument } from "./message-document.js";
import type { MessageEntry } from "./message-entry.js";
import type { TaskGroupNode } from "./task-group-node.js";
import type { TaskNode } from "./task-node.js";
import type { UnknownTaskNode } from "./unknown-task-node.js";

describe("isConversationTaskRequest", () => {
  it("accepts nested text input and protocol-neutral generation settings", () => {
    const entry = createMessageEntry("entry-user", [createTextContent("content-user", "你好")]);
    const messages = createMessageDocument([entry]);
    const input = createConversationInput("input", messages);
    const parameters = createParametersNode({ temperature: 0.7, stop: ["END"] });
    const section = createGroup("section", [input, parameters], "vendor.section");
    const request = createRequest([section]);

    // Complete validation composes the existing descriptor, Task, Message,
    // parameter, and Artifact boundaries without replacing any caller value.
    expect(isConversationTaskRequest(request)).toBe(true);
    expect(request.document.root.children[0]).toBe(section);
    expect(messages.root.children[0]).toBe(entry);
    expect(parameters.parameters.stop).toEqual(["END"]);
  });

  it("allows unknown Task nodes for the later explicit execution-range gate", () => {
    const unknown = createUnknownNode("future", "vendor.future_task");
    const request = createRequest([createConversationInput("input"), unknown]);

    // Structural preservation and current typed-payload validation are separate
    // from the later step that rejects unsupported executable Task kinds.
    expect(isConversationTaskRequest(request)).toBe(true);
    expect(request.document.root.children[1]).toBe(unknown);
  });

  it.each([undefined, null, true, 1, "request", [], () => undefined])(
    "rejects the non-record request %j",
    (candidate) => {
      // A request is always a named envelope with five explicit boundaries.
      expect(isConversationTaskRequest(candidate)).toBe(false);
    },
  );

  it("requires own stored request fields without executing accessors", () => {
    const documentGetter = vi.fn(() => {
      // Throw if validation reads an envelope accessor instead of its descriptor.
      throw new Error("document getter must not run");
    });
    const accessor = {
      ...createRequest(),
      get document(): never {
        // Route a forbidden read through the spy so execution is observable.
        return documentGetter();
      },
    };
    const missing = createRequest() as Partial<ConversationTaskRequest>;
    delete (missing as { metadata?: unknown }).metadata;

    expect(isConversationTaskRequest(accessor)).toBe(false);
    expect(isConversationTaskRequest(missing)).toBe(false);
    expect(documentGetter).not.toHaveBeenCalled();
  });

  it("requires the fixed conversation descriptor", () => {
    const wrongType = {
      ...createRequest(),
      descriptor: {
        type: "embedding.generate",
        metadata: {},
        extensions: {},
      },
    };
    const malformed = {
      ...createRequest(),
      descriptor: {
        type: "conversation.generate",
        metadata: { invalid: Number.NaN },
        extensions: {},
      },
    };

    // Document contents cannot infer or repair task identity and descriptor maps.
    expect(isConversationTaskRequest(wrongType)).toBe(false);
    expect(isConversationTaskRequest(malformed)).toBe(false);
  });

  it("requires a complete TaskDocument containing conversation input", () => {
    const invalidDocument = {
      ...createRequest(),
      document: {
        ...createRequest().document,
        root: createGroup("root", [], "vendor.root"),
      },
    };
    const noInput = createRequest([createUnknownNode("future", "vendor.future")]);

    // A fixed conversation request cannot be empty or derive input from an
    // unknown node, and the root identity remains the TaskDocument validator's job.
    expect(isConversationTaskRequest(invalidDocument)).toBe(false);
    expect(isConversationTaskRequest(noInput)).toBe(false);
  });

  it("requires input-purpose text MessageDocuments", () => {
    const outputMessages = createMessageDocument([], "output");
    const unsupportedContent: MessageContent = {
      id: "content-image",
      kind: "provider.content.image",
      metadata: {},
      extensions: {},
    };
    const nonTextMessages = createMessageDocument([
      createMessageEntry("entry-image", [unsupportedContent]),
    ]);

    // Structurally valid output documents and open content remain representable
    // in the domain but are outside this request's text-input execution range.
    expect(
      isConversationTaskRequest(createRequest([createConversationInput("input", outputMessages)])),
    ).toBe(false);
    expect(
      isConversationTaskRequest(createRequest([createConversationInput("input", nonTextMessages)])),
    ).toBe(false);
  });

  it("validates every generation-configuration node semantically", () => {
    const invalid = createParametersNode({
      temperature: Number.NaN,
      maxOutputTokens: 0,
    });
    const request = createRequest([createConversationInput("input"), invalid]);

    // TaskNode accepts numeric storage shape, while this request boundary applies
    // the dedicated finite/range semantics before any adapter or I/O stage.
    expect(isConversationTaskRequest(request)).toBe(false);
  });

  it("requires an explicit empty dense ArtifactCatalog", () => {
    const artifact = createArtifact("artifact-1");
    const nonEmpty = createRequest(undefined, { artifacts: [artifact] });
    const missing = { ...createRequest(), artifacts: {} };
    const accessorGetter = vi.fn(() => {
      // Throw if Catalog validation evaluates its collection accessor.
      throw new Error("artifacts getter must not run");
    });
    const accessorCatalog = Object.defineProperty({}, "artifacts", {
      enumerable: true,
      get: accessorGetter,
    });
    const accessor = { ...createRequest(), artifacts: accessorCatalog };
    const statefulCatalog = new Proxy(
      { artifacts: [] },
      {
        get: (target, property, receiver) => {
          // Descriptor validation sees stable storage; the later range check
          // simulates a hostile direct collection read.
          if (property === "artifacts") {
            throw new Error("catalog range failure");
          }
          return Reflect.get(target, property, receiver);
        },
      },
    );
    const stateful = { ...createRequest(), artifacts: statefulCatalog };

    // The current text-only range rejects every non-empty scope before source
    // inspection and never treats a missing or accessor collection as empty.
    expect(isConversationTaskRequest(nonEmpty)).toBe(false);
    expect(isConversationTaskRequest(missing)).toBe(false);
    expect(isConversationTaskRequest(accessor)).toBe(false);
    expect(() => isConversationTaskRequest(stateful)).not.toThrow();
    expect(isConversationTaskRequest(stateful)).toBe(false);
    expect(accessorGetter).not.toHaveBeenCalled();
  });

  it("requires portable request metadata and extensions", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    // Valid nested Task data cannot mask a non-record or cyclic request map.
    expect(isConversationTaskRequest({ ...createRequest(), metadata: [] })).toBe(false);
    expect(isConversationTaskRequest({ ...createRequest(), extensions: cyclic })).toBe(false);
  });

  it("allows unknown envelope fields without consulting them", () => {
    const unknownGetter = vi.fn(() => {
      // Throw if validation interprets application-owned request state.
      throw new Error("unknown getter must not run");
    });
    const request = {
      ...createRequest(),
      futureOption: true,
      get applicationState(): never {
        // Route any forbidden read through the spy so execution is observable.
        return unknownGetter();
      },
    };

    expect(isConversationTaskRequest(request)).toBe(true);
    expect(unknownGetter).not.toHaveBeenCalled();
    expect(request.futureOption).toBe(true);
  });

  it("contains Proxy failures and leaves a valid request unchanged", () => {
    const proxy = new Proxy(
      {},
      {
        ownKeys: () => {
          // Simulate a hostile request-envelope reflection boundary.
          throw new Error("request failure");
        },
      },
    );
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    const messageProxy = new Proxy(createMessageDocument([]), {
      get: (target, property, receiver) => {
        // Structural validators use descriptors; the support traversal's later
        // direct root read simulates a stateful hostile boundary failure.
        if (property === "root") {
          throw new Error("message traversal failure");
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const proxiedMessageRequest = createRequest([createConversationInput("input", messageProxy)]);
    const request = createRequest([
      createConversationInput("input"),
      createParametersNode({ seed: -7 }),
    ]);
    const original = structuredClone(request);

    // Hostile values fail closed. Successful validation performs no defaulting,
    // traversal reorder, mapping, freezing, copying into, or caller mutation.
    expect(isConversationTaskRequest(proxy)).toBe(false);
    expect(isConversationTaskRequest(revoked.proxy)).toBe(false);
    expect(() => isConversationTaskRequest(proxiedMessageRequest)).not.toThrow();
    expect(isConversationTaskRequest(proxiedMessageRequest)).toBe(false);
    expect(isConversationTaskRequest(request)).toBe(true);
    expect(request).toEqual(original);
  });

  it("exposes the intended conversation-request type-guard signature", () => {
    // Lock the public validator to one reusable unknown-input predicate.
    expectTypeOf(isConversationTaskRequest).toEqualTypeOf<
      (value: unknown) => value is ConversationTaskRequest
    >();
  });
});

/** Creates one complete request with caller-selected Task nodes and Artifact scope. */
function createRequest(
  children: readonly TaskNode[] = [createConversationInput("input")],
  artifacts: ArtifactCatalog = { artifacts: [] },
): ConversationTaskRequest {
  // Every boundary is explicit so tests never depend on Builder defaults or
  // model/access state outside the Task request contract.
  return {
    descriptor: {
      type: "conversation.generate",
      metadata: {},
      extensions: {},
    },
    document: {
      version: "1.0",
      root: createGroup("root", children, "task.root"),
      metadata: {},
      extensions: {},
    },
    artifacts,
    metadata: {},
    extensions: {},
  };
}

/** Creates one conversation-input leaf around a complete MessageDocument. */
function createConversationInput(
  id: string,
  messages: MessageDocument = createMessageDocument([]),
): TaskNode {
  // The concrete discriminator and leaf shape ensure Message data enters only
  // through its typed Task node.
  return {
    id,
    kind: "task.input.conversation",
    composition: "leaf",
    messages,
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Creates one generation-configuration leaf from dynamic semantic fixtures. */
function createParametersNode(parameters: object): GenerationParametersNode {
  // The cast permits invalid runtime ranges while retaining valid numeric/string
  // storage, allowing request tests to isolate dedicated semantic validation.
  return {
    id: "parameters",
    kind: "task.configuration",
    composition: "leaf",
    parameters: parameters as GenerationParametersNode["parameters"],
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Creates one open unknown leaf that remains structurally preservable. */
function createUnknownNode(id: string, kind: string): UnknownTaskNode {
  // No typed payload is attached, leaving later execution-range logic solely
  // responsible for deciding support for the open Kind.
  return {
    id,
    kind,
    composition: "leaf",
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Creates one ordered Task container with an explicit open Kind. */
function createGroup(id: string, children: readonly TaskNode[], kind: string): TaskGroupNode {
  // Child identity and order remain caller-owned so traversal side effects are
  // observable in tests.
  return {
    id,
    kind,
    composition: "container",
    children,
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Creates one complete MessageDocument with caller-selected purpose and entries. */
function createMessageDocument(
  children: readonly MessageEntry[],
  purpose: MessageDocument["purpose"] = "input",
): MessageDocument {
  // Root identity and every preservation collection are explicit; no message
  // builder or Task-level behavior participates in this fixture.
  return {
    version: "1.0",
    purpose,
    root: {
      id: "message-root",
      kind: "message.root",
      composition: "container",
      children,
      relations: [],
      metadata: {},
      extensions: {},
    },
    metadata: {},
    extensions: {},
  };
}

/** Creates one Message entry with an ordered content collection. */
function createMessageEntry(id: string, content: readonly MessageContent[]): MessageEntry {
  // The standard user role is sufficient for content-range tests and does not
  // introduce unrelated role-mapping behavior.
  return {
    id,
    kind: "message.entry",
    role: { id: "message.user", extensions: {} },
    content,
    relations: [],
    metadata: {},
    extensions: {},
  };
}

/** Creates one supported plain-text Message content value. */
function createTextContent(id: string, text: string): MessageContent {
  // Retain exact Unicode text without trim, aggregation, or protocol mapping.
  return {
    id,
    kind: "content.text",
    text,
    metadata: {},
    extensions: {},
  };
}

/** Creates one structurally valid Artifact for the unsupported non-empty case. */
function createArtifact(id: string): Artifact {
  // The request range rejects on Catalog cardinality and never reads this source.
  return {
    id,
    kind: { id: "artifact.unknown", extensions: {} },
    source: { kind: "provider.source.fixture" },
    metadata: {},
    extensions: {},
  };
}
