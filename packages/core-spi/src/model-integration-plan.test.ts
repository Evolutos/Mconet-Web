// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ServiceAccess } from "@evolutos/mconet-core-domain";

import type { ComponentDescriptor } from "./component-descriptor.js";
import type { ModelIntegrationMatch } from "./model-integration-match.js";
import type { ModelIntegrationPlan } from "./model-integration-plan.js";
import type { ModelTargetMatch } from "./model-target-match.js";
import type { RuntimeComponent } from "./runtime-component.js";
import type { TaskMatch } from "./task-match.js";

/**
 * Creates one distinguishable runtime component for a fixed plan role.
 *
 * @param name Diagnostic component name.
 * @returns A component whose descriptor identity remains observable in tests.
 */
const createComponent = (name: string): RuntimeComponent => {
  const descriptor: ComponentDescriptor = {
    name,
    version: "1.0.0",
    capabilities: new Set(),
    source: "plugin",
  };

  // Return the exact descriptor object so plan assertions can prove that no
  // registry lookup, component reconstruction, or metadata copy occurred.
  return { descriptor };
};

it("defines only immutable integration plan snapshot fields", () => {
  // Exact equality keeps the plan limited to current executable roles and
  // excludes internal binding, matcher, registry, and selection behavior.
  expectTypeOf<ModelIntegrationPlan>().toEqualTypeOf<{
    readonly source: "direct_adapter" | "resolved_binding";
    readonly bindingId?: string;
    readonly bindingVersion?: string;
    readonly match?: ModelIntegrationMatch;
    readonly taskProtocolAdapter: RuntimeComponent;
    readonly authorizationHandlers: readonly RuntimeComponent[];
    readonly defaultServiceAccess?: ServiceAccess;
    readonly payloadEncoders: readonly RuntimeComponent[];
    readonly payloadDecoders: readonly RuntimeComponent[];
    readonly transports: readonly RuntimeComponent[];
    readonly extensions: Readonly<Record<string, unknown>>;
  }>();
});

it("preserves a resolved binding snapshot and ordered component identities", () => {
  const target: ModelTargetMatch = { matched: true, score: 400, diagnostics: [] };
  const task: TaskMatch = { matched: true, score: 200, diagnostics: [] };
  const match: ModelIntegrationMatch = { target, task };
  const taskProtocolAdapter = createComponent("task-adapter");
  const bearerHandler = createComponent("bearer-handler");
  const anonymousHandler = createComponent("anonymous-handler");
  const encoder = createComponent("json-encoder");
  const successDecoder = createComponent("json-success-decoder");
  const errorDecoder = createComponent("json-error-decoder");
  const transport = createComponent("fetch-transport");
  const defaultServiceAccess: ServiceAccess = {
    headers: [],
    query: [],
    extensions: {},
  };
  const extensions = { integrationFamily: "openai-compatible" } as const;
  const plan: ModelIntegrationPlan = {
    source: "resolved_binding",
    bindingId: "openai-compatible.conversation",
    bindingVersion: "1.0.0",
    match,
    taskProtocolAdapter,
    authorizationHandlers: [bearerHandler, anonymousHandler],
    defaultServiceAccess,
    payloadEncoders: [encoder],
    payloadDecoders: [successDecoder, errorDecoder],
    transports: [transport],
    extensions,
  };

  // A resolved plan snapshots concrete instances and declaration order. It does
  // not retain IDs that require later lookup or reorder candidates by metadata.
  expect(plan.source).toBe("resolved_binding");
  expect(plan.bindingId).toBe("openai-compatible.conversation");
  expect(plan.bindingVersion).toBe("1.0.0");
  expect(plan.match).toBe(match);
  expect(plan.taskProtocolAdapter).toBe(taskProtocolAdapter);
  expect(plan.authorizationHandlers).toEqual([bearerHandler, anonymousHandler]);
  expect(plan.authorizationHandlers[0]).toBe(bearerHandler);
  expect(plan.defaultServiceAccess).toBe(defaultServiceAccess);
  expect(plan.payloadEncoders[0]).toBe(encoder);
  expect(plan.payloadDecoders).toEqual([successDecoder, errorDecoder]);
  expect(plan.transports[0]).toBe(transport);
  expect(plan.extensions).toBe(extensions);
});

it("represents a direct plan with only its injected adapter", () => {
  const taskProtocolAdapter = createComponent("application-task-adapter");
  const plan: ModelIntegrationPlan = {
    source: "direct_adapter",
    taskProtocolAdapter,
    authorizationHandlers: [],
    payloadEncoders: [],
    payloadDecoders: [],
    transports: [],
    extensions: {},
  };

  // The direct path bypasses binding resolution. Empty candidate collections
  // make that absence explicit while later component sources remain available.
  expect(plan.source).toBe("direct_adapter");
  expect(plan.taskProtocolAdapter).toBe(taskProtocolAdapter);
  expect(plan.bindingId).toBeUndefined();
  expect(plan.bindingVersion).toBeUndefined();
  expect(plan.match).toBeUndefined();
  expect(plan.defaultServiceAccess).toBeUndefined();
  expect(plan.authorizationHandlers).toEqual([]);
  expect(plan.payloadEncoders).toEqual([]);
  expect(plan.payloadDecoders).toEqual([]);
  expect(plan.transports).toEqual([]);
});

it("prevents replacement or membership mutation of plan facts", () => {
  const proveReadonly = (
    plan: ModelIntegrationPlan,
    component: RuntimeComponent,
    match: ModelIntegrationMatch,
  ): void => {
    // This compile-only helper locks provenance, nested snapshots, candidates,
    // and extensions without mutating a runtime fixture.
    // @ts-expect-error Plan provenance cannot be replaced.
    plan.source = "resolved_binding";
    // @ts-expect-error Match facts cannot be replaced.
    plan.match = match;
    // @ts-expect-error The fixed adapter cannot be replaced.
    plan.taskProtocolAdapter = component;
    // @ts-expect-error Candidate membership cannot be extended.
    plan.payloadDecoders.push(component);
    // @ts-expect-error The extension snapshot cannot be replaced.
    plan.extensions = {};
    // @ts-expect-error Read-only extension membership cannot be rewritten.
    plan.extensions.example = true;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});

it("does not retain internal binding, matchers, component IDs, or behavior", () => {
  // The plan is an execution snapshot rather than a business registration or a
  // live reference back to mutable integration resolver state.
  expectTypeOf<ModelIntegrationPlan>().not.toHaveProperty("binding");
  expectTypeOf<ModelIntegrationPlan>().not.toHaveProperty("targetMatcher");
  expectTypeOf<ModelIntegrationPlan>().not.toHaveProperty("taskMatcher");
  expectTypeOf<ModelIntegrationPlan>().not.toHaveProperty("componentIds");
  expectTypeOf<ModelIntegrationPlan>().not.toHaveProperty("registry");
  expectTypeOf<ModelIntegrationPlan>().not.toHaveProperty("resolve");
  expectTypeOf<ModelIntegrationPlan>().not.toHaveProperty("register");
});
