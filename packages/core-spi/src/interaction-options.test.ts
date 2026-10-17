// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type {
  CompatibilityPolicy,
  InteractionMode,
  InteractionResourceLimits,
  ServiceAccess,
} from "@evolutos/mconet-core-domain";

import type { InteractionOptions } from "./interaction-options.js";
import type { MonitoringOptions } from "./monitoring-options.js";
import type { RuntimeComponents } from "./runtime-components.js";

it("defines exactly the single-interaction option surface", () => {
  // Exact equality prevents reusable Client defaults, request payloads, resolved
  // signals, credentials, or execution results entering this public boundary.
  expectTypeOf<InteractionOptions>().toEqualTypeOf<{
    readonly mode?: InteractionMode;
    readonly components?: RuntimeComponents;
    readonly serviceAccessOverride?: ServiceAccess;
    readonly compatibilityPolicy?: CompatibilityPolicy;
    readonly resourceLimits?: InteractionResourceLimits;
    readonly monitoringOptions?: MonitoringOptions;
    readonly signal?: AbortSignal;
    readonly deadline?: number;
    readonly includeRawResponse?: boolean;
  }>();
});

it("allows every single-interaction choice to remain absent", () => {
  const options: InteractionOptions = {};

  // Absence contributes no override and does not create a signal, deadline,
  // component layer, monitoring list, or raw-response capture request.
  expect(options).toEqual({});
  expect(options.components).toBeUndefined();
  expect(options.signal).toBeUndefined();
  expect(options.deadline).toBeUndefined();
  expect(options.includeRawResponse).toBeUndefined();
});

it("accepts each resolution group independently", () => {
  const componentsOnly: InteractionOptions = {
    components: { authorizationHandlers: [] },
  };
  const accessOnly: InteractionOptions = {
    serviceAccessOverride: { headers: [], query: [], extensions: {} },
  };
  const policyOnly: InteractionOptions = {
    compatibilityPolicy: { mode: "strict" },
  };
  const limitsOnly: InteractionOptions = {
    resourceLimits: { maxFrameBytes: 2_048 },
  };
  const monitoringOnly: InteractionOptions = {
    monitoringOptions: { mergeMode: "replace" },
  };
  const lifecycleOnly: InteractionOptions = {
    signal: new AbortController().signal,
    deadline: 10_000,
    includeRawResponse: false,
  };

  // Independent groups avoid placeholder configuration and preserve separate
  // resolver responsibilities for data, behavior, observation, and lifecycle.
  expect(componentsOnly.components?.authorizationHandlers).toEqual([]);
  expect(accessOnly.serviceAccessOverride?.headers).toEqual([]);
  expect(policyOnly.compatibilityPolicy?.mode).toBe("strict");
  expect(limitsOnly.resourceLimits?.maxFrameBytes).toBe(2_048);
  expect(monitoringOnly.monitoringOptions?.mergeMode).toBe("replace");
  expect(lifecycleOnly).toMatchObject({ deadline: 10_000, includeRawResponse: false });
});

it("retains all caller-owned objects and explicit primitive choices", () => {
  const components: RuntimeComponents = { authorizationHandlers: [] };
  const serviceAccessOverride: ServiceAccess = {
    headers: [],
    query: [],
    extensions: {},
  };
  const compatibilityPolicy: CompatibilityPolicy = { mode: "compatible" };
  const resourceLimits: InteractionResourceLimits = { maxResponseBodyBytes: 4_096 };
  const monitoringOptions: MonitoringOptions = {
    monitors: [],
    captureRequestBody: false,
    captureResponseBody: true,
    maxCapturedBodyBytes: 512,
  };
  const signal = new AbortController().signal;
  const options: InteractionOptions = {
    components,
    serviceAccessOverride,
    compatibilityPolicy,
    resourceLimits,
    monitoringOptions,
    signal,
    deadline: 20_000,
    includeRawResponse: true,
  };

  // The interface stores inputs without cloning, validation, merging, deadline
  // conversion, signal subscription, component selection, or body allocation.
  expect(options.components).toBe(components);
  expect(options.serviceAccessOverride).toBe(serviceAccessOverride);
  expect(options.compatibilityPolicy).toBe(compatibilityPolicy);
  expect(options.resourceLimits).toBe(resourceLimits);
  expect(options.monitoringOptions).toBe(monitoringOptions);
  expect(options.signal).toBe(signal);
  expect(options.deadline).toBe(20_000);
  expect(options.includeRawResponse).toBe(true);
});

it("prevents replacement of every interaction option", () => {
  const proveReadonly = (options: InteractionOptions): void => {
    // This helper is compile-only; each invalid assignment locks the outer
    // per-call snapshot without claiming ownership of nested caller objects.
    // @ts-expect-error The component override cannot be replaced through this view.
    options.components = undefined;
    // @ts-expect-error Service access cannot be replaced through this view.
    options.serviceAccessOverride = undefined;
    // @ts-expect-error Compatibility policy cannot be replaced through this view.
    options.compatibilityPolicy = undefined;
    // @ts-expect-error Resource limits cannot be replaced through this view.
    options.resourceLimits = undefined;
    // @ts-expect-error Monitoring options cannot be replaced through this view.
    options.monitoringOptions = undefined;
    // @ts-expect-error Caller cancellation cannot be replaced through this view.
    options.signal = undefined;
    // @ts-expect-error The absolute deadline cannot be replaced through this view.
    options.deadline = undefined;
    // @ts-expect-error Raw-response intent cannot be replaced through this view.
    options.includeRawResponse = undefined;
  };

  // Keep the helper reachable for strict TypeScript analysis without executing
  // any intentional invalid write against a real options object.
  expectTypeOf(proveReadonly).toBeFunction();
});

it("excludes reusable Client defaults from a per-call override", () => {
  const rejectTarget = (): InteractionOptions => ({
    // Model target selection belongs to ModelRequest or reusable Client defaults.
    // @ts-expect-error InteractionOptions cannot provide defaultTarget.
    defaultTarget: {
      serviceId: "service.example",
      protocolId: "protocol.example",
      model: { name: "model-example", metadata: {}, extensions: {} },
      extensions: {},
    },
  });
  const rejectMonitoringDefaults = (): InteractionOptions => ({
    // Per-call monitoring uses monitoringOptions and cannot redefine Client defaults.
    // @ts-expect-error monitoringDefaults belongs to ModelClientConfiguration.
    monitoringDefaults: {},
  });

  expectTypeOf(rejectTarget).toBeFunction();
  expectTypeOf(rejectMonitoringDefaults).toBeFunction();
});
