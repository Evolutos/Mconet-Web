// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { ModelRequest } from "./model-request.js";
import { ModelRequestBuilder } from "./model-request-builder.js";
import type { ModelTarget } from "./model-target.js";
import type { ModelTaskRequest } from "./model-task-request.js";
import type { ServiceAccess } from "./service-access.js";

it("matches direct construction while preserving absent service access", () => {
  const target = createTarget();
  const task = createTask();
  const metadata = { traceId: "trace-1" } as const;
  const extensions = { "application.priority": 2 } as const;
  const builder = new ModelRequestBuilder(target, task);
  const returned = builder.withMetadata(metadata).withExtensions(extensions);
  const built = builder.build();
  const direct: ModelRequest = { target, task, metadata, extensions };

  // Equality and identity jointly prove envelope equivalence without rebuilding
  // either required domain value or inventing optional access.
  expect(returned).toBe(builder);
  expect(built).toEqual(direct);
  expect(built.target).toBe(target);
  expect(built.task).toBe(task);
  expect(built.metadata).toBe(metadata);
  expect(built.extensions).toBe(extensions);
  expect(Object.hasOwn(built, "serviceAccess")).toBe(false);
  expect(Object.isFrozen(built)).toBe(true);
});

it("sets and clears service access with true optional semantics", () => {
  const access = createServiceAccess();
  const builder = new ModelRequestBuilder(createTarget(), createTask()).withServiceAccess(access);
  const withAccess = builder.build();
  builder.withServiceAccess(undefined);
  const withoutAccess = builder.build();

  // A present override retains identity; clearing creates a new envelope whose
  // property is absent instead of storing undefined.
  expect(withAccess.serviceAccess).toBe(access);
  expect(Object.hasOwn(withAccess, "serviceAccess")).toBe(true);
  expect(withoutAccess).not.toBe(withAccess);
  expect(Object.hasOwn(withoutAccess, "serviceAccess")).toBe(false);
});

it("isolates earlier envelopes from later fluent replacements", () => {
  const firstMetadata = { turn: 1 } as const;
  const firstExtensions = { "vendor.mode": "first" } as const;
  const builder = new ModelRequestBuilder(createTarget(), createTask())
    .withMetadata(firstMetadata)
    .withExtensions(firstExtensions);
  const first = builder.build();
  builder.withMetadata({ turn: 2 }).withExtensions({ "vendor.mode": "second" });
  const second = builder.build();

  // Later reference replacement changes only future envelopes; no Builder-owned
  // mutable map can rewrite an already returned request.
  expect(first).not.toBe(second);
  expect(first.metadata).toBe(firstMetadata);
  expect(first.extensions).toBe(firstExtensions);
  expect(second.metadata).toEqual({ turn: 2 });
  expect(second.extensions).toEqual({ "vendor.mode": "second" });
});

it("delegates target task access and JSON semantics to isModelRequest", () => {
  const invalidTarget = { ...createTarget(), serviceId: "invalid service" };
  const invalidTask = {
    ...createTask(),
    descriptor: { ...createTask().descriptor, type: "other" },
  };
  const invalidAccess = { ...createServiceAccess(), headers: [{ name: "Bad", value: "x" }] };
  const invalidMetadata = { value: Number.NaN } as Readonly<Record<string, JsonValue>>;

  // Independent invalid domains all fail only at build, demonstrating that the
  // Builder does not maintain parallel partial validators or normalization.
  expect(() => new ModelRequestBuilder(invalidTarget, createTask()).build()).toThrow(TypeError);
  expect(() => new ModelRequestBuilder(createTarget(), invalidTask).build()).toThrow(TypeError);
  expect(() =>
    new ModelRequestBuilder(createTarget(), createTask()).withServiceAccess(invalidAccess).build(),
  ).toThrow(TypeError);
  expect(() =>
    new ModelRequestBuilder(createTarget(), createTask()).withMetadata(invalidMetadata).build(),
  ).toThrow(TypeError);
});

it("does not mutate or freeze caller-owned nested values", () => {
  const target = createTarget();
  const task = createTask();
  const access = createServiceAccess();
  const metadata: Record<string, JsonValue> = { request: "mutable" };
  const extensions: Extensions = { "vendor.mutable": true };
  const targetBefore = structuredClone(target);
  const taskBefore = structuredClone(task);
  const built = new ModelRequestBuilder(target, task)
    .withServiceAccess(access)
    .withMetadata(metadata)
    .withExtensions(extensions)
    .build();

  // Only the output envelope is frozen; nested ownership and caller mutability
  // remain identical to direct interface construction.
  expect(target).toEqual(targetBefore);
  expect(task).toEqual(taskBefore);
  expect(built.target).toBe(target);
  expect(built.task).toBe(task);
  expect(Object.isFrozen(target)).toBe(false);
  expect(Object.isFrozen(task)).toBe(false);
  expect(Object.isFrozen(access)).toBe(false);
  expect(Object.isFrozen(metadata)).toBe(false);
});

it("exposes no runtime component or execution configuration surface", () => {
  const builder = new ModelRequestBuilder(createTarget(), createTask());
  const request = builder.build();

  // Private state remains non-enumerable and the output contains only the public
  // ModelRequest envelope rather than interaction or transport behavior.
  expect(Object.keys(builder)).toEqual([]);
  expect("interactionMode" in request).toBe(false);
  expect("adapter" in request).toBe(false);
  expect("encoder" in request).toBe(false);
  expect("transport" in request).toBe(false);
  expect("signal" in request).toBe(false);
});

it("has exact constructor and fluent method signatures", () => {
  // Static assertions prevent optional access, maps, or result type from drifting
  // into a different construction layer.
  expectTypeOf(ModelRequestBuilder).toBeConstructibleWith(createTarget(), createTask());
  expectTypeOf<ModelRequestBuilder["withServiceAccess"]>().toEqualTypeOf<
    (serviceAccess: ServiceAccess | undefined) => ModelRequestBuilder
  >();
  expectTypeOf<ModelRequestBuilder["withMetadata"]>().toEqualTypeOf<
    (metadata: Readonly<Record<string, JsonValue>>) => ModelRequestBuilder
  >();
  expectTypeOf<ModelRequestBuilder["withExtensions"]>().toEqualTypeOf<
    (extensions: Extensions) => ModelRequestBuilder
  >();
  expectTypeOf<ModelRequestBuilder["build"]>().toEqualTypeOf<() => ModelRequest>();
});

/** Creates one complete protocol-neutral model target. */
function createTarget(): ModelTarget {
  // Service, protocol, and model identities remain intentionally independent.
  return {
    serviceId: "service.vendor",
    protocolId: "protocol.vendor",
    model: { name: "model-1", metadata: {}, extensions: {} },
    extensions: {},
  };
}

/** Creates one valid conversation task request without using another Builder. */
function createTask(): ModelTaskRequest {
  // The nested Message document supplies the current supported conversation
  // input while keeping outer ModelRequest construction independently testable.
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
            id: "input",
            kind: "task.input.conversation",
            composition: "leaf",
            messages: {
              version: "1.0",
              purpose: "input",
              root: {
                id: "message-root",
                kind: "message.root",
                composition: "container",
                children: [
                  {
                    id: "user",
                    kind: "message.entry",
                    role: { id: "message.user", extensions: {} },
                    content: [
                      {
                        id: "text",
                        kind: "content.text",
                        text: "Hello",
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

/** Creates one valid unresolved request-level service access contribution. */
function createServiceAccess(): ServiceAccess {
  // Empty ordered header/query collections prove the Builder does not synthesize
  // endpoint or authorization values while retaining the complete access shape.
  return { headers: [], query: [], extensions: {} };
}
