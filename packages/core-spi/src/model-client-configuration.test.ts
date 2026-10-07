// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type {
  CompatibilityPolicy,
  InteractionResourceLimits,
  ModelTarget,
  ServiceAccess,
} from "@evolutos/mconet-core-domain";

import type { ModelClientConfiguration } from "./model-client-configuration.js";
import type { MonitoringOptions } from "./monitoring-options.js";
import type { RuntimeComponents } from "./runtime-components.js";

it("defines exactly the reusable client configuration surface", () => {
  // Exact equality prevents request data, execution state, credentials, resolved
  // defaults, or unsupported component placeholders entering the public boundary.
  expectTypeOf<ModelClientConfiguration>().toEqualTypeOf<{
    readonly defaultTarget?: ModelTarget;
    readonly defaultServiceAccess?: ServiceAccess;
    readonly defaultCompatibilityPolicy?: CompatibilityPolicy;
    readonly defaultResourceLimits?: InteractionResourceLimits;
    readonly components?: RuntimeComponents;
    readonly monitoringDefaults?: MonitoringOptions;
  }>();
});

it("allows construction with every reusable input omitted", () => {
  const configuration: ModelClientConfiguration = {};

  // Absence is preserved instead of eagerly allocating defaults. Later Client
  // construction and interaction resolution own all fallback decisions.
  expect(configuration).toEqual({});
  expect(configuration.defaultTarget).toBeUndefined();
  expect(configuration.components).toBeUndefined();
  expect(configuration.monitoringDefaults).toBeUndefined();
});

it("accepts each configuration group independently", () => {
  const domainOnly: ModelClientConfiguration = {
    defaultCompatibilityPolicy: { mode: "compatible" },
  };
  const componentsOnly: ModelClientConfiguration = {
    components: { authorizationHandlers: [] },
  };
  const monitoringOnly: ModelClientConfiguration = {
    monitoringDefaults: { mergeMode: "append" },
  };

  // Independent groups let consumers configure data, executable components, or
  // observation without manufacturing unrelated placeholder values.
  expect(domainOnly.defaultCompatibilityPolicy?.mode).toBe("compatible");
  expect(componentsOnly.components?.authorizationHandlers).toEqual([]);
  expect(monitoringOnly.monitoringDefaults?.mergeMode).toBe("append");
});

it("retains every caller-owned configuration identity", () => {
  const defaultTarget: ModelTarget = {
    serviceId: "service.example",
    protocolId: "protocol.example",
    model: { name: "model-example", metadata: {}, extensions: {} },
    extensions: {},
  };
  const defaultServiceAccess: ServiceAccess = {
    headers: [],
    query: [],
    extensions: {},
  };
  const defaultCompatibilityPolicy: CompatibilityPolicy = { mode: "compatible" };
  const defaultResourceLimits: InteractionResourceLimits = { maxResponseBodyBytes: 1_024 };
  const components: RuntimeComponents = { authorizationHandlers: [] };
  const monitoringDefaults: MonitoringOptions = {
    monitors: [],
    mergeMode: "prepend",
    captureRequestBody: false,
    captureResponseBody: false,
  };
  const configuration: ModelClientConfiguration = {
    defaultTarget,
    defaultServiceAccess,
    defaultCompatibilityPolicy,
    defaultResourceLimits,
    components,
    monitoringDefaults,
  };

  // An interface introduces no cloning, normalization, selection, monitoring
  // merge, or ownership transfer; every nested value remains caller-owned here.
  expect(configuration.defaultTarget).toBe(defaultTarget);
  expect(configuration.defaultServiceAccess).toBe(defaultServiceAccess);
  expect(configuration.defaultCompatibilityPolicy).toBe(defaultCompatibilityPolicy);
  expect(configuration.defaultResourceLimits).toBe(defaultResourceLimits);
  expect(configuration.components).toBe(components);
  expect(configuration.monitoringDefaults).toBe(monitoringDefaults);
});

it("prevents replacement of every configuration field", () => {
  const proveReadonly = (configuration: ModelClientConfiguration): void => {
    // This compile-only helper locks the outer configuration without claiming
    // deep ownership of caller-supplied domain, component, or monitor objects.
    // @ts-expect-error The default target cannot be replaced through this view.
    configuration.defaultTarget = undefined;
    // @ts-expect-error Default service access cannot be replaced through this view.
    configuration.defaultServiceAccess = undefined;
    // @ts-expect-error Compatibility policy cannot be replaced through this view.
    configuration.defaultCompatibilityPolicy = undefined;
    // @ts-expect-error Resource limits cannot be replaced through this view.
    configuration.defaultResourceLimits = undefined;
    // @ts-expect-error The component layer cannot be replaced through this view.
    configuration.components = undefined;
    // @ts-expect-error Monitoring defaults cannot be replaced through this view.
    configuration.monitoringDefaults = undefined;
  };

  // Retain the helper for strict compile-time assertions without executing any
  // intentional invalid assignment against a real configuration object.
  expectTypeOf(proveReadonly).toBeFunction();
});

it("excludes interaction-only lifecycle and response choices", () => {
  const rejectSignal = (): ModelClientConfiguration => ({
    // A reusable Client must never retain one interaction's cancellation source.
    // @ts-expect-error AbortSignal belongs to InteractionOptions.
    signal: new AbortController().signal,
  });
  const rejectDeadline = (): ModelClientConfiguration => ({
    // An absolute deadline cannot be shared by later independent interactions.
    // @ts-expect-error Deadline belongs to InteractionOptions.
    deadline: 1_000,
  });
  const rejectRawResponse = (): ModelClientConfiguration => ({
    // Response capture intent is resolved per interaction, not stored as a Client default.
    // @ts-expect-error Raw response selection belongs to InteractionOptions.
    includeRawResponse: true,
  });

  expectTypeOf(rejectSignal).toBeFunction();
  expectTypeOf(rejectDeadline).toBeFunction();
  expectTypeOf(rejectRawResponse).toBeFunction();
});
