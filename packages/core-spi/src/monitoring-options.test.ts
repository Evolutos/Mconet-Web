// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { InteractionMonitor } from "./interaction-monitor.js";
import type { MonitoringOptions } from "./monitoring-options.js";

it("defines only immutable monitoring configuration fields", () => {
  // Exact equality prevents resolved defaults, event snapshots, publishers,
  // credentials, headers, or unrestricted body values entering configuration.
  expectTypeOf<MonitoringOptions>().toEqualTypeOf<{
    readonly monitors?: readonly InteractionMonitor[];
    readonly mergeMode?: "append" | "prepend" | "replace";
    readonly captureRequestBody?: boolean;
    readonly captureResponseBody?: boolean;
    readonly maxCapturedBodyBytes?: number;
  }>();
});

it("preserves ordered monitors and explicit bounded capture settings", () => {
  const firstMonitor: InteractionMonitor = {
    descriptor: {
      name: "first-monitor",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    async onEvent() {
      // Configuration tests never publish events; this no-op keeps the fixture
      // structurally complete without introducing monitoring chain behavior.
    },
  };
  const secondMonitor: InteractionMonitor = {
    descriptor: {
      name: "second-monitor",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    async onEvent() {
      // A distinct no-op instance lets the test verify caller-declared order and
      // identity without implementing event dispatch or component selection.
    },
  };
  const monitors = [firstMonitor, secondMonitor] as const;
  const options: MonitoringOptions = {
    monitors,
    mergeMode: "prepend",
    captureRequestBody: true,
    captureResponseBody: true,
    maxCapturedBodyBytes: 4_096,
  };

  // The structural contract retains caller choices. Validation, defaulting, and
  // client/interaction list merging belong to the later configuration resolver.
  expect(options.monitors).toBe(monitors);
  expect(options.monitors).toEqual([firstMonitor, secondMonitor]);
  expect(options).toMatchObject({
    mergeMode: "prepend",
    captureRequestBody: true,
    captureResponseBody: true,
    maxCapturedBodyBytes: 4_096,
  });
});

it("represents secure defaults by omitting every optional field", () => {
  const options: MonitoringOptions = {};

  // No constructor allocates a monitor array or enables body capture. The later
  // resolver interprets absence as empty/append/false/false without mutating this
  // caller-owned value.
  expect(options).toEqual({});
  expect(options.monitors).toBeUndefined();
  expect(options.mergeMode).toBeUndefined();
  expect(options.captureRequestBody).toBeUndefined();
  expect(options.captureResponseBody).toBeUndefined();
  expect(options.maxCapturedBodyBytes).toBeUndefined();
});

it("accepts exactly the three monitoring merge modes", () => {
  expectTypeOf<"append">().toMatchTypeOf<NonNullable<MonitoringOptions["mergeMode"]>>();
  expectTypeOf<"prepend">().toMatchTypeOf<NonNullable<MonitoringOptions["mergeMode"]>>();
  expectTypeOf<"replace">().toMatchTypeOf<NonNullable<MonitoringOptions["mergeMode"]>>();
  expectTypeOf<"merge">().not.toMatchTypeOf<NonNullable<MonitoringOptions["mergeMode"]>>();
});

it("prevents configuration and monitor collection mutation", () => {
  const proveReadonly = (options: MonitoringOptions, monitor: InteractionMonitor): void => {
    // This helper remains compile-only so strict TypeScript locks every option
    // without attempting to mutate caller configuration at runtime.
    // @ts-expect-error The ordered monitor collection cannot be replaced.
    options.monitors = [];
    // @ts-expect-error Readonly monitor collections cannot gain members.
    options.monitors?.push(monitor);
    // @ts-expect-error The merge policy cannot be replaced.
    options.mergeMode = "replace";
    // @ts-expect-error Request capture selection is immutable.
    options.captureRequestBody = false;
    // @ts-expect-error Response capture selection is immutable.
    options.captureResponseBody = false;
    // @ts-expect-error The configured byte limit is immutable.
    options.maxCapturedBodyBytes = 1;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});

it("does not expose captured bodies events or publishing behavior", () => {
  // Configuration states intent only; sensitive snapshots and runtime behavior
  // remain confined to validated monitoring execution boundaries.
  expectTypeOf<MonitoringOptions>().not.toHaveProperty("requestBody");
  expectTypeOf<MonitoringOptions>().not.toHaveProperty("responseBody");
  expectTypeOf<MonitoringOptions>().not.toHaveProperty("events");
  expectTypeOf<MonitoringOptions>().not.toHaveProperty("publish");
  expectTypeOf<MonitoringOptions>().not.toHaveProperty("authorization");
});
