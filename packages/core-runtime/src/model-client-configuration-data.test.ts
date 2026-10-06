// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type {
  CompatibilityPolicy,
  InteractionResourceLimits,
  ModelTarget,
  ServiceAccess,
} from "@evolutos/mconet-core-domain";

import type { ModelClientConfigurationData } from "./model-client-configuration-data.js";

it("defines only the four reusable domain-data defaults", () => {
  // Exact equality prevents component instances, monitoring behavior, signals,
  // deadlines, or interaction-only flags from entering this data contract.
  expectTypeOf<ModelClientConfigurationData>().toEqualTypeOf<{
    readonly defaultTarget?: ModelTarget;
    readonly defaultServiceAccess?: ServiceAccess;
    readonly defaultCompatibilityPolicy?: CompatibilityPolicy;
    readonly defaultResourceLimits?: InteractionResourceLimits;
  }>();
});

it("allows a client to omit every data default", () => {
  const configuration: ModelClientConfigurationData = {};

  // An empty layer contributes no values and leaves each later resolver free to
  // use request, interaction, integration, or finite SDK fallbacks.
  expect(configuration).toEqual({});
});

it("allows each default to be supplied independently", () => {
  const targetOnly: ModelClientConfigurationData = {
    defaultTarget: {
      serviceId: "service.example",
      protocolId: "protocol.example",
      model: { name: "model-example", metadata: {}, extensions: {} },
      extensions: {},
    },
  };
  const accessOnly: ModelClientConfigurationData = {
    defaultServiceAccess: {
      headers: [],
      query: [],
      extensions: {},
    },
  };
  const policyOnly: ModelClientConfigurationData = {
    defaultCompatibilityPolicy: { mode: "compatible" },
  };
  const limitsOnly: ModelClientConfigurationData = {
    defaultResourceLimits: { maxResponseBodyBytes: 1024 },
  };

  // Independent optional fields model distinct resolution rules instead of
  // requiring an all-or-nothing client configuration object.
  expect(targetOnly.defaultTarget?.serviceId).toBe("service.example");
  expect(accessOnly.defaultServiceAccess?.headers).toEqual([]);
  expect(policyOnly.defaultCompatibilityPolicy?.mode).toBe("compatible");
  expect(limitsOnly.defaultResourceLimits?.maxResponseBodyBytes).toBe(1024);
});

it("retains caller-owned domain objects by reference", () => {
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
  const defaultResourceLimits: InteractionResourceLimits = { maxFrameBytes: 2048 };
  const configuration: ModelClientConfigurationData = {
    defaultTarget,
    defaultServiceAccess,
    defaultCompatibilityPolicy,
    defaultResourceLimits,
  };

  // The interface is a storage contract without hidden cloning, normalization,
  // validation, component selection, or resource-limit resolution behavior.
  expect(configuration.defaultTarget).toBe(defaultTarget);
  expect(configuration.defaultServiceAccess).toBe(defaultServiceAccess);
  expect(configuration.defaultCompatibilityPolicy).toBe(defaultCompatibilityPolicy);
  expect(configuration.defaultResourceLimits).toBe(defaultResourceLimits);
});

it("prevents replacement of every configured default", () => {
  const proveReadonly = (configuration: ModelClientConfigurationData): void => {
    // Exercise forbidden writes only during type checking. This helper is never
    // invoked and therefore cannot mutate a real client configuration.
    // @ts-expect-error The default target is immutable configuration data.
    configuration.defaultTarget = undefined;
    // @ts-expect-error Service access cannot be replaced through the data view.
    configuration.defaultServiceAccess = undefined;
    // @ts-expect-error Compatibility policy cannot be replaced after capture.
    configuration.defaultCompatibilityPolicy = undefined;
    // @ts-expect-error Resource-limit input cannot be replaced after capture.
    configuration.defaultResourceLimits = undefined;
  };

  // Retain the helper so strict TypeScript checking enforces all readonly fields
  // without executing any of the intentional invalid assignments.
  expectTypeOf(proveReadonly).toBeFunction();
});

it("rejects component and interaction-lifecycle fields on object literals", () => {
  const rejectComponents = (): ModelClientConfigurationData => ({
    // The type deliberately contains no runtime component injection surface.
    // @ts-expect-error Components use their own deterministic selection path.
    components: {},
  });
  const rejectSignal = (): ModelClientConfigurationData => ({
    // Cancellation belongs to one interaction and cannot become a client default.
    // @ts-expect-error A reusable client data layer cannot own an AbortSignal.
    signal: new AbortController().signal,
  });

  // Type-check the negative examples without constructing invalid runtime data.
  expectTypeOf(rejectComponents).toBeFunction();
  expectTypeOf(rejectSignal).toBeFunction();
});
