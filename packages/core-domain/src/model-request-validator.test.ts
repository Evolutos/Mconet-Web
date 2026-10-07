// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { ConversationTaskRequest } from "./conversation-task-request.js";
import { isModelRequest, type ModelRequest } from "./model-request.js";
import type { ModelTarget } from "./model-target.js";
import type { ServiceAccess } from "./service-access.js";

describe("isModelRequest", () => {
  it("accepts complete requests with absent or supplied access", () => {
    const access = createServiceAccess();
    const withoutAccess = createRequest();
    const withAccess = createRequest(access);

    // True absence contributes no defaults, while a supplied access object and
    // every other nested boundary remain the caller's exact references.
    expect(isModelRequest(withoutAccess)).toBe(true);
    expect(Object.hasOwn(withoutAccess, "serviceAccess")).toBe(false);
    expect(isModelRequest(withAccess)).toBe(true);
    expect(withAccess.serviceAccess).toBe(access);
  });

  it.each([undefined, null, true, 1, "request", [], () => undefined])(
    "rejects the non-record request %j",
    (candidate) => {
      // ModelRequest is a named envelope rather than a scalar or collection.
      expect(isModelRequest(candidate)).toBe(false);
    },
  );

  it("requires every mandatory field as own stored data", () => {
    const taskGetter = vi.fn(() => {
      // Throw if validation executes an envelope accessor.
      throw new Error("task getter must not run");
    });
    const accessor = {
      ...createRequest(),
      get task(): never {
        // Route a forbidden read through the spy so execution is observable.
        return taskGetter();
      },
    };
    const missing = createRequest() as Partial<ModelRequest>;
    delete (missing as { target?: unknown }).target;

    expect(isModelRequest(accessor)).toBe(false);
    expect(isModelRequest(missing)).toBe(false);
    expect(taskGetter).not.toHaveBeenCalled();
  });

  it("delegates target validation without cross-field inference", () => {
    const invalidTarget = {
      ...createTarget(),
      protocolId: "bad protocol",
    };
    const request = { ...createRequest(), target: invalidTarget };

    // A valid task or access endpoint cannot repair an invalid protocol identity.
    expect(isModelRequest(request)).toBe(false);
  });

  it("accepts only the currently supported conversation Task boundary", () => {
    const wrongTask = {
      ...createConversationTask(),
      descriptor: {
        type: "embedding.generate",
        metadata: {},
        extensions: {},
      },
    };
    const request = { ...createRequest(), task: wrongTask };

    // ModelRequest stays task-neutral as a type, while the current runtime
    // validator delegates its executable range to ConversationTaskRequest.
    expect(isModelRequest(request)).toBe(false);
  });

  it("uses exact optional semantics for request-level access", () => {
    const getter = vi.fn(() => {
      // Throw if optional access is evaluated through an accessor.
      throw new Error("access getter must not run");
    });
    const accessor = Object.defineProperty(createRequest(), "serviceAccess", {
      enumerable: true,
      get: getter,
    });
    const malformed = {
      ...createRequest(),
      serviceAccess: { headers: [], query: [], extensions: [], endpoint: "https://example.test" },
    };

    // Explicit undefined is not absence, and nested access syntax is never
    // coerced or inferred from strings.
    expect(isModelRequest({ ...createRequest(), serviceAccess: undefined })).toBe(false);
    expect(isModelRequest(accessor)).toBe(false);
    expect(isModelRequest(malformed)).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });

  it("requires portable metadata and extensions", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    // Nested valid request data cannot mask non-record or cyclic annotation maps.
    expect(isModelRequest({ ...createRequest(), metadata: [] })).toBe(false);
    expect(isModelRequest({ ...createRequest(), extensions: cyclic })).toBe(false);
  });

  it("allows unknown fields without consulting them", () => {
    const unknownGetter = vi.fn(() => {
      // Throw if validation interprets application-owned state.
      throw new Error("unknown getter must not run");
    });
    const request = {
      ...createRequest(),
      traceId: "trace-1",
      get runtimeState(): never {
        // Route a forbidden read through the spy so execution is observable.
        return unknownGetter();
      },
    };

    expect(isModelRequest(request)).toBe(true);
    expect(unknownGetter).not.toHaveBeenCalled();
    expect(request.traceId).toBe("trace-1");
  });

  it("contains Proxy failures and leaves accepted input unchanged", () => {
    const proxy = new Proxy(
      {},
      {
        ownKeys: () => {
          // Simulate failure at the outer request reflection boundary.
          throw new Error("request failure");
        },
      },
    );
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    const request = createRequest(createServiceAccess());
    const original = structuredClone(request);

    // Delegated validators also fail closed; successful composition performs no
    // resolution, merge, mapping, copying into, freezing, or caller mutation.
    expect(isModelRequest(proxy)).toBe(false);
    expect(isModelRequest(revoked.proxy)).toBe(false);
    expect(isModelRequest(request)).toBe(true);
    expect(request).toEqual(original);
  });

  it("exposes the intended model-request type-guard signature", () => {
    // Lock the public API to one reusable unknown-input predicate.
    expectTypeOf(isModelRequest).toEqualTypeOf<(value: unknown) => value is ModelRequest>();
  });
});

/** Creates one complete ModelRequest with exact optional access omission. */
function createRequest(serviceAccess?: ServiceAccess): ModelRequest {
  const common = {
    target: createTarget(),
    task: createConversationTask(),
    metadata: {},
    extensions: {},
  } as const;

  // Conditional object construction preserves absence instead of storing an
  // undefined access sentinel that the validator must reject.
  return serviceAccess === undefined ? common : { ...common, serviceAccess };
}

/** Creates one valid target with independent service protocol and model identity. */
function createTarget(): ModelTarget {
  // No endpoint or authorization data is duplicated into target selection.
  return {
    serviceId: "service.vendor",
    protocolId: "protocol.vendor",
    model: { name: "model-a", metadata: {}, extensions: {} },
    extensions: {},
  };
}

/** Creates one minimal supported text conversation Task. */
function createConversationTask(): ConversationTaskRequest {
  // The nested request is built directly so ModelRequest tests exercise its real
  // validator rather than a mock or bypass flag.
  return {
    descriptor: { type: "conversation.generate", metadata: {}, extensions: {} },
    document: {
      version: "1.0",
      root: {
        id: "task-root",
        kind: "task.root",
        composition: "container",
        children: [
          {
            id: "conversation-input",
            kind: "task.input.conversation",
            composition: "leaf",
            messages: {
              version: "1.0",
              purpose: "input",
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
            },
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
    },
    artifacts: { artifacts: [] },
    metadata: {},
    extensions: {},
  };
}

/** Creates one valid unresolved request-level access contribution. */
function createServiceAccess(): ServiceAccess {
  // Empty ordered header/query collections and portable extensions form the
  // smallest access layer without endpoint or credential inference.
  return { headers: [], query: [], extensions: {} };
}
