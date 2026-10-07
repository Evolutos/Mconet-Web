// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import {
  ModelInteractionError,
  type InteractionMode,
  type ModelTarget,
  type TaskDescriptor,
} from "@evolutos/mconet-core-domain";
import type { ModelIntegrationPlan, TaskProtocolAdapter } from "@evolutos/mconet-core-spi";

import { createDirectModelIntegrationPlan } from "./create-direct-model-integration-plan.js";

const target: ModelTarget = {
  serviceId: "service.example",
  protocolId: "protocol.example",
  model: { name: "model-example", metadata: {}, extensions: {} },
  extensions: {},
};
const task: TaskDescriptor = {
  type: "conversation.generate",
  metadata: {},
  extensions: {},
};
const mode: InteractionMode = { id: "unary" };

it("exposes one exact direct-plan factory signature", () => {
  // The factory receives only the explicit adapter and support tuple; policy,
  // resolver, binding, Codec, Transport, and access data remain outside.
  expectTypeOf(createDirectModelIntegrationPlan).toEqualTypeOf<
    (
      input: Readonly<{
        readonly adapter: TaskProtocolAdapter;
        readonly target: ModelTarget;
        readonly task: TaskDescriptor;
        readonly mode: InteractionMode;
      }>,
    ) => ModelIntegrationPlan
  >();
});

it("validates support once and creates a minimal frozen direct plan", () => {
  const supports = vi.fn((): boolean => {
    // Accept the configured tuple without invoking planning; this callback proves
    // the factory performs only the required support check.
    return true;
  });
  const adapter = createAdapter(supports);
  const input = { adapter, target, task, mode } as const;

  const plan = createDirectModelIntegrationPlan(input);

  // Direct provenance retains the exact Adapter and contains no Binding-owned
  // candidates or defaults that could affect later fixed component resolution.
  expect(plan).toEqual({
    source: "direct_adapter",
    taskProtocolAdapter: adapter,
    authorizationHandlers: [],
    payloadEncoders: [],
    payloadDecoders: [],
    transports: [],
    extensions: {},
  });
  expect(plan.taskProtocolAdapter).toBe(adapter);
  expect(Object.hasOwn(plan, "bindingId")).toBe(false);
  expect(Object.hasOwn(plan, "bindingVersion")).toBe(false);
  expect(Object.hasOwn(plan, "match")).toBe(false);
  expect(Object.hasOwn(plan, "defaultServiceAccess")).toBe(false);
  expect(Object.isFrozen(plan)).toBe(true);
  expect(Object.isFrozen(plan.authorizationHandlers)).toBe(true);
  expect(Object.isFrozen(plan.payloadEncoders)).toBe(true);
  expect(Object.isFrozen(plan.payloadDecoders)).toBe(true);
  expect(Object.isFrozen(plan.transports)).toBe(true);
  expect(Object.isFrozen(plan.extensions)).toBe(true);
  expect(plan.authorizationHandlers).not.toBe(plan.payloadEncoders);
  expect(plan.payloadEncoders).not.toBe(plan.payloadDecoders);
  expect(plan.payloadDecoders).not.toBe(plan.transports);
  expect(supports).toHaveBeenCalledOnce();
  expect(supports).toHaveBeenCalledWith({ target, task, mode });
  expect(supports.mock.calls[0]?.[0].target).toBe(target);
  expect(supports.mock.calls[0]?.[0].task).toBe(task);
  expect(supports.mock.calls[0]?.[0].mode).toBe(mode);
});

it("fails unsupported direct injection without constructing a fallback plan", () => {
  const supports = vi.fn((): boolean => {
    // Reject the tuple explicitly; direct injection must not consult a default
    // ModelIntegrationResolver or fabricate Binding candidates afterward.
    return false;
  });
  const error = captureInteractionError(() => {
    createDirectModelIntegrationPlan({ adapter: createAdapter(supports), target, task, mode });
  });

  expect(error).toMatchObject({
    category: "unsupported_feature",
    phase: "resolution",
    code: "unsupported_model_integration",
    diagnostics: [
      {
        code: "unsupported_model_integration",
        severity: "error",
        phase: "resolution",
        serviceId: target.serviceId,
        details: {
          protocolId: target.protocolId,
          taskType: task.type,
          modeId: mode.id,
        },
      },
    ],
  });
  expect(supports).toHaveBeenCalledOnce();
});

it("preserves a support-check failure without invoking another adapter stage", () => {
  const supportFailure = new Error("private support failure");
  const supports = vi.fn((): boolean => {
    // Concrete adapter failures cross this narrow factory unchanged; the later
    // Runtime unknown-error boundary owns normalization and safe cause handling.
    throw supportFailure;
  });
  const adapter = createAdapter(supports);

  expect(() => createDirectModelIntegrationPlan({ adapter, target, task, mode })).toThrow(
    supportFailure,
  );
  expect(supports).toHaveBeenCalledOnce();
});

/** Creates an inert protocol adapter whose only permitted operation is supports. */
function createAdapter(supports: TaskProtocolAdapter["supports"]): TaskProtocolAdapter {
  // Every later method fails deterministically if the direct-plan factory grows
  // beyond support validation and minimal immutable plan construction.
  return {
    descriptor: {
      name: "direct-fixture-adapter",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    supports,
    preparePlan() {
      // Planning belongs after integration selection and cannot occur here.
      return failUnexpectedAdapterCall();
    },
    buildRequest() {
      // Request mapping belongs after execution components are resolved.
      return failUnexpectedAdapterCall();
    },
    parseResponse() {
      // Response parsing requires decoded transport output and cannot occur here.
      return failUnexpectedAdapterCall();
    },
    parseError() {
      // Service-error parsing is likewise outside direct-plan construction.
      return failUnexpectedAdapterCall();
    },
  };
}

/** Fails any adapter operation outside the single permitted support check. */
function failUnexpectedAdapterCall(): never {
  // A plain test failure makes accidental orchestration visible without creating
  // a misleading domain result for a stage the fixture never configured.
  throw new Error("Direct-plan factory invoked an unexpected adapter operation.");
}

/** Captures the expected classified direct-adapter resolution failure safely. */
function captureInteractionError(action: () => void): ModelInteractionError {
  try {
    // Execute once so support-call counts and the allocated error remain exact.
    action();
  } catch (error) {
    if (error instanceof ModelInteractionError) {
      return error;
    }
    // Preserve unexpected failure identity for the test runner without casting.
    throw new Error("Expected ModelInteractionError.", { cause: error });
  }

  throw new Error("Expected direct adapter resolution to fail.");
}
