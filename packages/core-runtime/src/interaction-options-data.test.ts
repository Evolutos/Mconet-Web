// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type {
  CompatibilityPolicy,
  InteractionResourceLimits,
  ServiceAccess,
} from "@evolutos/mconet-core-domain";

import type { InteractionOptionsData } from "./interaction-options-data.js";

it("defines only interaction data and lifecycle inputs", () => {
  // Exact equality prevents component instances, monitoring behavior, targets,
  // or unrelated client defaults from entering this single-interaction carrier.
  expectTypeOf<InteractionOptionsData>().toEqualTypeOf<{
    readonly serviceAccessOverride?: ServiceAccess;
    readonly compatibilityPolicy?: CompatibilityPolicy;
    readonly resourceLimits?: InteractionResourceLimits;
    readonly signal?: AbortSignal;
    readonly deadline?: number;
    readonly includeRawResponse?: boolean;
  }>();
});

it("allows every interaction option to be omitted", () => {
  const options: InteractionOptionsData = {};

  // An empty interaction layer contributes no override or lifecycle state and
  // leaves lower-priority configuration unchanged.
  expect(options).toEqual({});
});

it("allows each configuration override to be supplied independently", () => {
  const accessOnly: InteractionOptionsData = {
    serviceAccessOverride: { headers: [], query: [], extensions: {} },
  };
  const policyOnly: InteractionOptionsData = {
    compatibilityPolicy: { mode: "strict" },
  };
  const limitsOnly: InteractionOptionsData = {
    resourceLimits: { maxStreamingErrorBodyBytes: 4096 },
  };

  // Independent fields preserve the separate access, compatibility, and
  // resource-limit resolution rules used by the later merger.
  expect(accessOnly.serviceAccessOverride?.headers).toEqual([]);
  expect(policyOnly.compatibilityPolicy?.mode).toBe("strict");
  expect(limitsOnly.resourceLimits?.maxStreamingErrorBodyBytes).toBe(4096);
});

it("retains one interaction cancellation signal and deadline", () => {
  const controller = new AbortController();
  const options: InteractionOptionsData = {
    signal: controller.signal,
    deadline: 1_800_000_000_000,
  };

  // This representation stores caller input by reference and value only; it
  // does not subscribe, abort, schedule a timer, or compose another signal.
  expect(options.signal).toBe(controller.signal);
  expect(options.deadline).toBe(1_800_000_000_000);
  expect(options.signal?.aborted).toBe(false);
});

it("represents the raw-response request as an optional boolean", () => {
  const enabled: InteractionOptionsData = { includeRawResponse: true };
  const disabled: InteractionOptionsData = { includeRawResponse: false };

  // Both explicit states remain distinct from absence; later resolution owns
  // the default and the bounded raw-response implementation.
  expect(enabled.includeRawResponse).toBe(true);
  expect(disabled.includeRawResponse).toBe(false);
  expect({} satisfies InteractionOptionsData).not.toHaveProperty("includeRawResponse");
});

it("prevents replacement of every interaction option", () => {
  const proveReadonly = (options: InteractionOptionsData): void => {
    // Exercise invalid writes solely during type checking. The helper remains
    // uncalled, so no interaction state is modified at runtime.
    // @ts-expect-error Service access is immutable interaction input.
    options.serviceAccessOverride = undefined;
    // @ts-expect-error Compatibility policy is immutable interaction input.
    options.compatibilityPolicy = undefined;
    // @ts-expect-error Resource limits are immutable interaction input.
    options.resourceLimits = undefined;
    // @ts-expect-error The caller signal reference cannot be replaced.
    options.signal = undefined;
    // @ts-expect-error The deadline value cannot be replaced.
    options.deadline = undefined;
    // @ts-expect-error The raw-response request cannot be replaced.
    options.includeRawResponse = undefined;
  };

  // Retain the compile-time helper without executing its intentional writes.
  expectTypeOf(proveReadonly).toBeFunction();
});

it("rejects runtime component fields on object literals", () => {
  const rejectComponents = (): InteractionOptionsData => ({
    // Runtime components use their own deterministic selection path.
    // @ts-expect-error The pure interaction data carrier has no component field.
    components: {},
  });

  // Type-check the negative example without constructing invalid runtime data.
  expectTypeOf(rejectComponents).toBeFunction();
});
