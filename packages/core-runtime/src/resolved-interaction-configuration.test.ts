// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type {
  CompatibilityPolicy,
  ModelTarget,
  ResolvedInteractionResourceLimits,
  ServiceAccess,
} from "@evolutos/mconet-core-domain";

import type { ResolvedInteractionConfiguration } from "./resolved-interaction-configuration.js";

it("defines the exact complete configuration result", () => {
  // Exact equality locks the result to five required readonly properties and
  // prevents components, monitors, deadlines, raw responses, or secrets from
  // entering this configuration snapshot.
  expectTypeOf<ResolvedInteractionConfiguration>().toEqualTypeOf<{
    readonly target: ModelTarget;
    readonly serviceAccess: ServiceAccess | undefined;
    readonly compatibilityPolicy: CompatibilityPolicy;
    readonly resourceLimits: ResolvedInteractionResourceLimits;
    readonly signal: AbortSignal | undefined;
  }>();
});

it("requires every property including explicit absence states", () => {
  // Optional-valued access and signal properties are still required keys. This
  // distinguishes a complete resolved snapshot from an unfinished partial one.
  expectTypeOf<{
    readonly target: ModelTarget;
    readonly compatibilityPolicy: CompatibilityPolicy;
    readonly resourceLimits: ResolvedInteractionResourceLimits;
  }>().not.toMatchTypeOf<ResolvedInteractionConfiguration>();
  expectTypeOf<{
    readonly target?: ModelTarget;
    readonly serviceAccess?: ServiceAccess;
    readonly compatibilityPolicy?: CompatibilityPolicy;
    readonly resourceLimits?: ResolvedInteractionResourceLimits;
    readonly signal?: AbortSignal;
  }>().not.toMatchTypeOf<ResolvedInteractionConfiguration>();
});

it("retains all selected values by reference", () => {
  const target: ModelTarget = {
    serviceId: "service.example",
    protocolId: "protocol.example",
    model: { name: "model-example", metadata: {}, extensions: {} },
    extensions: {},
  };
  const serviceAccess: ServiceAccess = {
    endpoint: { kind: "absolute", value: "https://models.example.test" },
    headers: [],
    query: [],
    extensions: {},
  };
  const compatibilityPolicy: CompatibilityPolicy = { mode: "compatible" };
  const resourceLimits: ResolvedInteractionResourceLimits = {
    maxResponseBodyBytes: 100,
    maxStreamingErrorBodyBytes: 200,
    maxFrameBytes: 300,
  };
  const controller = new AbortController();
  const configuration: ResolvedInteractionConfiguration = {
    target,
    serviceAccess,
    compatibilityPolicy,
    resourceLimits,
    signal: controller.signal,
  };

  // The interface records selection only. It performs no cloning, validation,
  // access-field merge, signal subscription, or resource-limit normalization.
  expect(configuration.target).toBe(target);
  expect(configuration.serviceAccess).toBe(serviceAccess);
  expect(configuration.compatibilityPolicy).toBe(compatibilityPolicy);
  expect(configuration.resourceLimits).toBe(resourceLimits);
  expect(configuration.signal).toBe(controller.signal);
});

it("preserves explicit access and signal absence", () => {
  const configuration: ResolvedInteractionConfiguration = {
    target: {
      serviceId: "service.example",
      protocolId: "protocol.example",
      model: { name: "model-example", metadata: {}, extensions: {} },
      extensions: {},
    },
    serviceAccess: undefined,
    compatibilityPolicy: { mode: "compatible" },
    resourceLimits: {
      maxResponseBodyBytes: 100,
      maxStreamingErrorBodyBytes: 200,
      maxFrameBytes: 300,
    },
    signal: undefined,
  };

  // Access absence permits a later integration-aware resolver to supply a
  // default; signal absence states that no caller cancellation source exists.
  expect(Object.hasOwn(configuration, "serviceAccess")).toBe(true);
  expect(configuration.serviceAccess).toBeUndefined();
  expect(Object.hasOwn(configuration, "signal")).toBe(true);
  expect(configuration.signal).toBeUndefined();
});

it("keeps semantic validation outside the representation interface", () => {
  const configuration: ResolvedInteractionConfiguration = {
    target: {
      serviceId: "",
      protocolId: "",
      model: { name: "", metadata: {}, extensions: {} },
      extensions: {},
    },
    serviceAccess: undefined,
    compatibilityPolicy: { mode: "integration-defined" },
    resourceLimits: {
      maxResponseBodyBytes: 0,
      maxStreamingErrorBodyBytes: -1,
      maxFrameBytes: Number.POSITIVE_INFINITY,
    },
    signal: undefined,
  };

  // The interface guarantees field presence and static shapes only. Existing
  // and later validators own identifier, model, policy, and numeric semantics.
  expect(configuration.target.serviceId).toBe("");
  expect(configuration.resourceLimits.maxResponseBodyBytes).toBe(0);
});

it("prevents replacement of every resolved property", () => {
  const proveReadonly = (configuration: ResolvedInteractionConfiguration): void => {
    // Exercise invalid writes only during type checking. The helper is not
    // invoked and therefore cannot mutate a real resolved configuration.
    const replacementTarget = configuration.target;
    const replacementPolicy = configuration.compatibilityPolicy;
    const replacementLimits = configuration.resourceLimits;
    // @ts-expect-error The selected target cannot be replaced.
    configuration.target = replacementTarget;
    // @ts-expect-error The selected access state cannot be replaced.
    configuration.serviceAccess = undefined;
    // @ts-expect-error The selected compatibility policy cannot be replaced.
    configuration.compatibilityPolicy = replacementPolicy;
    // @ts-expect-error The resolved byte limits cannot be replaced.
    configuration.resourceLimits = replacementLimits;
    // @ts-expect-error The selected signal reference cannot be replaced.
    configuration.signal = undefined;
  };

  // Retain the compile-time helper without executing its intentional writes.
  expectTypeOf(proveReadonly).toBeFunction();
});
