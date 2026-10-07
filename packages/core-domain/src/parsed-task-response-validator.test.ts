// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { Artifact } from "./artifact.js";
import type { ModelTaskResult } from "./model-task-result.js";
import { isParsedTaskResponse, type ParsedTaskResponse } from "./parsed-task-response.js";
import type { ProtocolState } from "./protocol-state.js";

describe("isParsedTaskResponse", () => {
  it("accepts a minimal response without inventing optional facts", () => {
    const response = createResponse();

    // Absence remains observable and no model, reason, or usage value is copied
    // from the result descriptor or synthesized from completed status.
    expect(isParsedTaskResponse(response)).toBe(true);
    expect(Object.hasOwn(response, "resolvedModel")).toBe(false);
    expect(Object.hasOwn(response, "stopReason")).toBe(false);
    expect(Object.hasOwn(response, "usage")).toBe(false);
  });

  it("accepts every reported fact and preserves state order", () => {
    const first = createState("response.cursor", "cursor-1");
    const second = createState("response.details", { accepted: true });
    const protocolState = [first, second] as const;
    const response = {
      ...createResponse(),
      resolvedModel: { name: "actual-model", metadata: {}, extensions: {} },
      status: "requires_action",
      stopReason: "provider.tool_calls",
      usage: { inputTokens: 0, outputTokens: 8, totalTokens: 8, extensions: {} },
      protocolState,
    };

    // Validation observes exact references and never sorts, aggregates, or
    // derives optional protocol facts.
    expect(isParsedTaskResponse(response)).toBe(true);
    expect(response.protocolState).toBe(protocolState);
    expect(response.protocolState).toEqual([first, second]);
  });

  it.each([undefined, null, true, 1, "response", [], () => undefined])(
    "rejects the non-record response %j",
    (candidate) => {
      // Parsed response facts require one named envelope.
      expect(isParsedTaskResponse(candidate)).toBe(false);
    },
  );

  it("requires own stored required fields without executing accessors", () => {
    const resultGetter = vi.fn(() => {
      // Throw if validation reads a result accessor.
      throw new Error("result getter must not run");
    });
    const accessor = {
      ...createResponse(),
      get result(): never {
        // Route a forbidden read through the spy so execution is observable.
        return resultGetter();
      },
    };
    const missing = createResponse() as Partial<ParsedTaskResponse>;
    delete (missing as { extensions?: unknown }).extensions;

    expect(isParsedTaskResponse(accessor)).toBe(false);
    expect(isParsedTaskResponse(missing)).toBe(false);
    expect(resultGetter).not.toHaveBeenCalled();
  });

  it("validates the complete task-neutral result", () => {
    const invalidDescriptor = {
      ...createResponse(),
      result: { ...createResult(), descriptor: { type: "bad type", metadata: {}, extensions: {} } },
    };
    const invalidDocument = {
      ...createResponse(),
      result: {
        ...createResult(),
        document: {
          ...createResult().document,
          root: { ...createResult().document.root, kind: "task.result_root" },
        },
      },
    };
    const invalidMaps = {
      ...createResponse(),
      result: { ...createResult(), metadata: { invalid: Number.NaN } },
    };

    // No parsed envelope can repair malformed task identity, tree, or maps.
    expect(isParsedTaskResponse(invalidDescriptor)).toBe(false);
    expect(isParsedTaskResponse(invalidDocument)).toBe(false);
    expect(isParsedTaskResponse(invalidMaps)).toBe(false);
  });

  it("validates result-local Artifacts and ID uniqueness", () => {
    const first = createArtifact("artifact-1");
    const valid = createResponse(createResult([first]));
    const duplicate = createResponse(createResult([first, createArtifact("artifact-1")]));
    const malformed = createResponse(
      createResult([{ ...first, metadata: [] } as unknown as Artifact]),
    );
    const missingCatalogCollection = createResponse({
      ...createResult(),
      artifacts: {} as never,
    });
    const sparseArtifacts = new Array<Artifact>(1);
    const sparseCatalog = createResponse(createResult(sparseArtifacts));
    const statefulCatalog = new Proxy(
      { artifacts: [] },
      {
        get: (target, property, receiver) => {
          // Descriptor inspection sees stable storage; the existing uniqueness
          // validator's later direct read simulates a hostile state change.
          if (property === "artifacts") {
            throw new Error("catalog read failure");
          }
          return Reflect.get(target, property, receiver);
        },
      },
    );
    const stateful = createResponse({
      ...createResult(),
      artifacts: statefulCatalog,
    });

    // Artifact structure and Catalog identity scope are both required; neither
    // source data nor external resources are read during validation.
    expect(isParsedTaskResponse(valid)).toBe(true);
    expect(isParsedTaskResponse(duplicate)).toBe(false);
    expect(isParsedTaskResponse(malformed)).toBe(false);
    expect(isParsedTaskResponse(missingCatalogCollection)).toBe(false);
    expect(isParsedTaskResponse(sparseCatalog)).toBe(false);
    expect(() => isParsedTaskResponse(stateful)).not.toThrow();
    expect(isParsedTaskResponse(stateful)).toBe(false);
  });

  it("uses exact optional semantics for parsed facts", () => {
    const usageGetter = vi.fn(() => {
      // Throw if validation executes an optional usage accessor.
      throw new Error("usage getter must not run");
    });
    const accessor = Object.defineProperty(createResponse(), "usage", {
      enumerable: true,
      get: usageGetter,
    });

    // Present undefined and accessors are not equivalent to service omission.
    expect(isParsedTaskResponse({ ...createResponse(), resolvedModel: undefined })).toBe(false);
    expect(isParsedTaskResponse({ ...createResponse(), resolvedModel: { name: "" } })).toBe(false);
    expect(isParsedTaskResponse({ ...createResponse(), stopReason: undefined })).toBe(false);
    expect(isParsedTaskResponse({ ...createResponse(), usage: undefined })).toBe(false);
    expect(isParsedTaskResponse(accessor)).toBe(false);
    expect(usageGetter).not.toHaveBeenCalled();
  });

  it("requires open status and finish-reason identities", () => {
    // Standard and integration-defined identifiers are valid, while whitespace
    // and non-string representations cannot be normalized into identities.
    expect(isParsedTaskResponse({ ...createResponse(), status: "vendor.paused" })).toBe(true);
    expect(isParsedTaskResponse({ ...createResponse(), status: "bad status" })).toBe(false);
    expect(isParsedTaskResponse({ ...createResponse(), stopReason: "" })).toBe(false);
    expect(isParsedTaskResponse({ ...createResponse(), stopReason: 1 })).toBe(false);
  });

  it.each([-1, -0, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, "1"])(
    "rejects the invalid token count %j",
    (inputTokens) => {
      // Reported counts must be canonical non-negative safe integers.
      expect(
        isParsedTaskResponse({
          ...createResponse(),
          usage: { inputTokens, extensions: {} },
        }),
      ).toBe(false);
    },
  );

  it("keeps usage fields independent and requires portable extensions", () => {
    // Provider total is not recomputed from components, but every usage object
    // must own one valid extension record.
    expect(
      isParsedTaskResponse({
        ...createResponse(),
        usage: { inputTokens: 3, outputTokens: 4, totalTokens: 99, extensions: {} },
      }),
    ).toBe(true);
    expect(isParsedTaskResponse({ ...createResponse(), usage: {} })).toBe(false);
    expect(
      isParsedTaskResponse({ ...createResponse(), usage: { extensions: { bad: undefined } } }),
    ).toBe(false);
  });

  it("validates dense ordered protocol-state facts and arbitrary JSON values", () => {
    const sparse = new Array<ProtocolState>(1);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const invalidIdentity = createState("bad state", null);
    const cyclicState = createState("response.state", cyclic as never);

    // State collections may be empty, but holes, invalid identity tuples, and
    // non-portable opaque values are rejected without coercion.
    expect(isParsedTaskResponse({ ...createResponse(), protocolState: sparse })).toBe(false);
    expect(isParsedTaskResponse({ ...createResponse(), protocolState: [null] })).toBe(false);
    expect(isParsedTaskResponse({ ...createResponse(), protocolState: [invalidIdentity] })).toBe(
      false,
    );
    expect(isParsedTaskResponse({ ...createResponse(), protocolState: [cyclicState] })).toBe(false);
  });

  it("requires portable response extensions and ignores unknown fields", () => {
    const getter = vi.fn(() => {
      // Throw if validation consults Runtime-owned or application-owned state.
      throw new Error("unknown getter must not run");
    });
    const response = {
      ...createResponse(),
      runtimeDiagnostic: true,
      get transportObservation(): never {
        // Route a forbidden read through the spy so execution is observable.
        return getter();
      },
    };

    expect(isParsedTaskResponse({ ...createResponse(), extensions: [] })).toBe(false);
    expect(isParsedTaskResponse(response)).toBe(true);
    expect(getter).not.toHaveBeenCalled();
  });

  it("contains Proxy failures and leaves accepted facts unchanged", () => {
    const proxy = new Proxy(
      {},
      {
        ownKeys: () => {
          // Simulate a hostile response reflection boundary.
          throw new Error("response failure");
        },
      },
    );
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    const response = {
      ...createResponse(createResult([createArtifact("artifact-1")])),
      protocolState: [createState("response.cursor", ["a", 1, true])],
    };
    const original = structuredClone(response);

    // Successful validation performs no defaulting, aggregation, reordering,
    // copying into, freezing, or mutation of caller-owned protocol facts.
    expect(isParsedTaskResponse(proxy)).toBe(false);
    expect(isParsedTaskResponse(revoked.proxy)).toBe(false);
    expect(isParsedTaskResponse(response)).toBe(true);
    expect(response).toEqual(original);
  });

  it("exposes the intended parsed-response type-guard signature", () => {
    // Lock the public API to one reusable unknown-input predicate.
    expectTypeOf(isParsedTaskResponse).toEqualTypeOf<
      (value: unknown) => value is ParsedTaskResponse
    >();
  });
});

/** Creates one parsed response while keeping optional facts truly absent. */
function createResponse(result: ModelTaskResult = createResult()): ParsedTaskResponse {
  // Required facts are supplied explicitly without model/reason/usage defaults.
  return { result, status: "completed", protocolState: [], extensions: {} };
}

/** Creates one complete task-neutral result with a valid Task root. */
function createResult(artifacts: readonly Artifact[] = []): ModelTaskResult {
  // Result-local Artifact scope and annotations remain independent from the tree.
  return {
    descriptor: { type: "vendor.result", metadata: {}, extensions: {} },
    document: {
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
    },
    artifacts: { artifacts },
    metadata: {},
    extensions: {},
  };
}

/** Creates one structurally valid result-local Artifact. */
function createArtifact(id: string): Artifact {
  // An open source kind proves validation does not perform I/O or byte reads.
  return {
    id,
    kind: { id: "artifact.unknown", extensions: {} },
    source: { kind: "provider.source.fixture" },
    metadata: {},
    extensions: {},
  };
}

/** Creates one ordered opaque protocol-state fact. */
function createState(stateType: string, stateValue: ProtocolState["stateValue"]): ProtocolState {
  // Keep service/protocol/type identities separate from the portable state value.
  return {
    serviceId: "service.vendor",
    protocolId: "protocol.vendor",
    stateType,
    stateValue,
  };
}
