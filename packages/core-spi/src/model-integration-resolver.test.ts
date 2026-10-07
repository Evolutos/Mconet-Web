// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import type {
  CompatibilityPolicy,
  InteractionMode,
  ModelTarget,
  TaskDescriptor,
} from "@evolutos/mconet-core-domain";

import type { ModelIntegrationPlan } from "./model-integration-plan.js";
import type { ModelIntegrationResolver } from "./model-integration-resolver.js";
import type { RuntimeComponent } from "./runtime-component.js";

it("defines the exact synchronous integration resolution boundary", () => {
  // RuntimeComponent supplies only descriptor metadata. The labelled input keeps
  // four structurally distinct matching facts from being passed positionally.
  expectTypeOf<ModelIntegrationResolver>().toMatchTypeOf<RuntimeComponent>();
  expectTypeOf<ModelIntegrationResolver["resolve"]>().toEqualTypeOf<
    (input: {
      readonly target: ModelTarget;
      readonly task: TaskDescriptor;
      readonly mode: InteractionMode;
      readonly policy: CompatibilityPolicy;
    }) => ModelIntegrationPlan
  >();
});

it("forwards the exact matching tuple and preserves a resolved plan identity", () => {
  const target: ModelTarget = {
    serviceId: "service.example",
    protocolId: "protocol.example",
    model: {
      name: "model-example",
      metadata: {},
      extensions: {},
    },
    extensions: {},
  };
  const task: TaskDescriptor = {
    type: "conversation.generate",
    metadata: {},
    extensions: {},
  };
  const mode: InteractionMode = { id: "unary" };
  const policy: CompatibilityPolicy = { mode: "compatible" };
  const taskProtocolAdapter: RuntimeComponent = {
    descriptor: {
      name: "resolved-task-adapter",
      version: "1.0.0",
      capabilities: new Set(),
      source: "plugin",
    },
  };
  const expected: ModelIntegrationPlan = {
    source: "resolved_binding",
    bindingId: "binding.example.conversation",
    bindingVersion: "1.0.0",
    match: {
      target: { matched: true, score: 400, diagnostics: [] },
      task: { matched: true, score: 200, diagnostics: [] },
    },
    taskProtocolAdapter,
    authorizationHandlers: [],
    payloadEncoders: [],
    payloadDecoders: [],
    transports: [],
    extensions: {},
  };
  const resolve = vi.fn((): ModelIntegrationPlan => {
    // Return the configured immutable snapshot directly; default matching table
    // behavior belongs to a concrete implementation rather than this SPI test.
    return expected;
  });
  const resolver: ModelIntegrationResolver = {
    descriptor: {
      name: "fixture-model-integration-resolver",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    resolve,
  };
  const input = { target, task, mode, policy } as const;

  // Reference assertions prove the abstract boundary neither rebuilds matching
  // inputs nor copies the selected plan or its fixed protocol adapter.
  const actual = resolver.resolve(input);
  expect(actual).toBe(expected);
  expect(actual.taskProtocolAdapter).toBe(taskProtocolAdapter);
  expect(resolve).toHaveBeenCalledOnce();
  expect(resolve).toHaveBeenCalledWith(input);
  expect(resolve.mock.calls[0]?.[0].target).toBe(target);
  expect(resolve.mock.calls[0]?.[0].task).toBe(task);
  expect(resolve.mock.calls[0]?.[0].mode).toBe(mode);
  expect(resolve.mock.calls[0]?.[0].policy).toBe(policy);
});

it("preserves a direct adapter plan without inventing binding provenance", () => {
  const expected: ModelIntegrationPlan = {
    source: "direct_adapter",
    taskProtocolAdapter: {
      descriptor: {
        name: "direct-task-adapter",
        version: "1.0.0",
        capabilities: new Set(),
        source: "application",
      },
    },
    authorizationHandlers: [],
    payloadEncoders: [],
    payloadDecoders: [],
    transports: [],
    extensions: {},
  };
  const resolver: ModelIntegrationResolver = {
    descriptor: {
      name: "custom-direct-plan-resolver",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    resolve() {
      // Custom resolvers may return either valid provenance. This fixture proves
      // the public SPI does not add binding facts to an existing direct plan.
      return expected;
    },
  };

  // The fixture ignores values because the test concerns output preservation;
  // ordinary structural inputs still cross the complete typed boundary.
  const actual = resolver.resolve({
    target: {
      serviceId: "service.example",
      protocolId: "protocol.example",
      model: { name: "model-example", metadata: {}, extensions: {} },
      extensions: {},
    },
    task: { type: "conversation.generate", metadata: {}, extensions: {} },
    mode: { id: "unary" },
    policy: { mode: "compatible" },
  });
  expect(actual).toBe(expected);
  expect(actual.bindingId).toBeUndefined();
  expect(actual.match).toBeUndefined();
});

it("preserves deterministic resolution failures without fallback", () => {
  const failure = new Error("ambiguous model integration");
  const resolver: ModelIntegrationResolver = {
    descriptor: {
      name: "failing-model-integration-resolver",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
    },
    resolve() {
      // The implementation reports its exact pre-interaction failure. The SPI
      // does not wrap it, retry, consult another resolver, or return a partial plan.
      throw failure;
    },
  };

  expect(() =>
    resolver.resolve({
      target: {
        serviceId: "service.example",
        protocolId: "protocol.example",
        model: { name: "model-example", metadata: {}, extensions: {} },
        extensions: {},
      },
      task: { type: "conversation.generate", metadata: {}, extensions: {} },
      mode: { id: "unary" },
      policy: { mode: "strict" },
    }),
  ).toThrow(failure);
});

it("does not expose registry credential authorization or transport behavior", () => {
  // Registration and execution remain outside this pure deterministic matching
  // boundary, so implementations can be replaced without broad capabilities.
  expectTypeOf<ModelIntegrationResolver>().not.toHaveProperty("register");
  expectTypeOf<ModelIntegrationResolver>().not.toHaveProperty("bindings");
  expectTypeOf<ModelIntegrationResolver>().not.toHaveProperty("componentIds");
  expectTypeOf<ModelIntegrationResolver>().not.toHaveProperty("getCredential");
  expectTypeOf<ModelIntegrationResolver>().not.toHaveProperty("apply");
  expectTypeOf<ModelIntegrationResolver>().not.toHaveProperty("send");
});
