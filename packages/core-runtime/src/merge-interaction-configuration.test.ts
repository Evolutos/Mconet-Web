// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  ModelTarget,
  ResolvedInteractionResourceLimits,
  ServiceAccess,
} from "@evolutos/mconet-core-domain";

import type { InteractionOptionsData } from "./interaction-options-data.js";
import { mergeInteractionConfiguration } from "./merge-interaction-configuration.js";
import type { ModelClientConfigurationData } from "./model-client-configuration-data.js";
import type { ResolvedInteractionConfiguration } from "./resolved-interaction-configuration.js";

const requestTarget: ModelTarget = {
  serviceId: "service.request",
  protocolId: "protocol.request",
  model: { name: "request-model", metadata: {}, extensions: {} },
  extensions: {},
};

const clientTarget: ModelTarget = {
  serviceId: "service.client",
  protocolId: "protocol.client",
  model: { name: "client-model", metadata: {}, extensions: {} },
  extensions: {},
};

const interactionAccess: ServiceAccess = {
  headers: [{ name: "x-source", value: "interaction" }],
  query: [],
  extensions: {},
};

const requestAccess: ServiceAccess = {
  headers: [{ name: "x-source", value: "request" }],
  query: [],
  extensions: {},
};

const clientAccess: ServiceAccess = {
  headers: [{ name: "x-source", value: "client" }],
  query: [],
  extensions: {},
};

const integrationAccess: ServiceAccess = {
  headers: [{ name: "x-source", value: "integration" }],
  query: [],
  extensions: {},
};

const sdkResourceLimits: ResolvedInteractionResourceLimits = {
  maxResponseBodyBytes: 100,
  maxStreamingErrorBodyBytes: 200,
  maxFrameBytes: 300,
};

const baseInput: Parameters<typeof mergeInteractionConfiguration>[0] = {
  requestTarget,
  requestServiceAccess: undefined,
  clientConfiguration: {},
  interactionOptions: {},
  integrationServiceAccess: undefined,
  sdkResourceLimits,
};

describe("mergeInteractionConfiguration", () => {
  // Exercise the exact public signature, every priority tier, failure behavior,
  // delegated resource resolution, immutability, and source preservation.
  it("defines one explicitly named source object and a complete result", () => {
    // Exact parameter equality prevents source deletion, transposition, or an
    // implicit global default from changing this deterministic boundary.
    expectTypeOf(mergeInteractionConfiguration).parameters.toEqualTypeOf<
      [
        input: Readonly<{
          readonly requestTarget: ModelTarget | undefined;
          readonly requestServiceAccess: ServiceAccess | undefined;
          readonly clientConfiguration: ModelClientConfigurationData;
          readonly interactionOptions: InteractionOptionsData;
          readonly integrationServiceAccess: ServiceAccess | undefined;
          readonly sdkResourceLimits: ResolvedInteractionResourceLimits;
        }>,
      ]
    >();
    expectTypeOf(
      mergeInteractionConfiguration,
    ).returns.toEqualTypeOf<ResolvedInteractionConfiguration>();
  });

  it("selects the request target before the client default", () => {
    const resolved = mergeInteractionConfiguration({
      ...baseInput,
      clientConfiguration: { defaultTarget: clientTarget },
    });

    // Request data has the documented higher priority and is preserved by
    // identity rather than normalized or copied.
    expect(resolved.target).toBe(requestTarget);
  });

  it("uses the client target when request data omits it", () => {
    const resolved = mergeInteractionConfiguration({
      ...baseInput,
      requestTarget: undefined,
      clientConfiguration: { defaultTarget: clientTarget },
    });

    // Client defaulting fills only true request absence.
    expect(resolved.target).toBe(clientTarget);
  });

  it("rejects resolution when both target sources are absent", () => {
    // The resolved interface requires a concrete target, so the merger fails
    // synchronously before constructing a partial result or performing I/O.
    expect(() => {
      // Invoke only within the throwing assertion boundary.
      mergeInteractionConfiguration({
        ...baseInput,
        requestTarget: undefined,
      });
    }).toThrow("requestTarget or clientConfiguration.defaultTarget must provide a target.");
  });

  it("selects whole service access inputs in the fixed four-tier order", () => {
    const cases = [
      {
        interactionOptions: { serviceAccessOverride: interactionAccess },
        requestServiceAccess: requestAccess,
        clientConfiguration: { defaultServiceAccess: clientAccess },
        integrationServiceAccess: integrationAccess,
        expected: interactionAccess,
      },
      {
        interactionOptions: {},
        requestServiceAccess: requestAccess,
        clientConfiguration: { defaultServiceAccess: clientAccess },
        integrationServiceAccess: integrationAccess,
        expected: requestAccess,
      },
      {
        interactionOptions: {},
        requestServiceAccess: undefined,
        clientConfiguration: { defaultServiceAccess: clientAccess },
        integrationServiceAccess: integrationAccess,
        expected: clientAccess,
      },
      {
        interactionOptions: {},
        requestServiceAccess: undefined,
        clientConfiguration: {},
        integrationServiceAccess: integrationAccess,
        expected: integrationAccess,
      },
      {
        interactionOptions: {},
        requestServiceAccess: undefined,
        clientConfiguration: {},
        integrationServiceAccess: undefined,
        expected: undefined,
      },
    ] as const;

    // Run one case for every winning tier plus complete absence; each assertion
    // uses identity to prove this step does not merge access fields.
    for (const testCase of cases) {
      const resolved = mergeInteractionConfiguration({
        ...baseInput,
        interactionOptions: testCase.interactionOptions,
        requestServiceAccess: testCase.requestServiceAccess,
        clientConfiguration: testCase.clientConfiguration,
        integrationServiceAccess: testCase.integrationServiceAccess,
      });
      expect(resolved.serviceAccess).toBe(testCase.expected);
    }
  });

  it("selects compatibility from interaction, client, then the standard default", () => {
    const interactionPolicy = { mode: "strict" } as const;
    const clientPolicy = { mode: "permissive" } as const;
    const interactionResolved = mergeInteractionConfiguration({
      ...baseInput,
      clientConfiguration: { defaultCompatibilityPolicy: clientPolicy },
      interactionOptions: { compatibilityPolicy: interactionPolicy },
    });
    const clientResolved = mergeInteractionConfiguration({
      ...baseInput,
      clientConfiguration: { defaultCompatibilityPolicy: clientPolicy },
    });
    const defaultResolved = mergeInteractionConfiguration(baseInput);

    // Explicit policies retain identity; absence creates the documented frozen
    // compatible policy without sharing either caller-owned object.
    expect(interactionResolved.compatibilityPolicy).toBe(interactionPolicy);
    expect(clientResolved.compatibilityPolicy).toBe(clientPolicy);
    expect(defaultResolved.compatibilityPolicy).toEqual({ mode: "compatible" });
    expect(Object.isFrozen(defaultResolved.compatibilityPolicy)).toBe(true);
  });

  it("resolves resource limits independently across all three tiers", () => {
    const resolved = mergeInteractionConfiguration({
      ...baseInput,
      clientConfiguration: {
        defaultResourceLimits: {
          maxResponseBodyBytes: 110,
          maxStreamingErrorBodyBytes: 220,
        },
      },
      interactionOptions: {
        resourceLimits: {
          maxResponseBodyBytes: 111,
          maxFrameBytes: 333,
        },
      },
    });

    // The three values originate from interaction, client, and interaction
    // layers respectively, proving whole-object replacement is not used.
    expect(resolved.resourceLimits).toEqual({
      maxResponseBodyBytes: 111,
      maxStreamingErrorBodyBytes: 220,
      maxFrameBytes: 333,
    });
    expect(Object.isFrozen(resolved.resourceLimits)).toBe(true);
  });

  it("does not hide invalid lower-priority resource limits", () => {
    const invalidClient: ModelClientConfigurationData = {
      defaultResourceLimits: { maxFrameBytes: 0 },
    };

    // Delegated validation runs before selecting winners, so a valid interaction
    // value cannot conceal a broken reusable Client configuration.
    expect(() => {
      // Resolve only inside the assertion so the expected layer failure is captured.
      mergeInteractionConfiguration({
        ...baseInput,
        clientConfiguration: invalidClient,
        interactionOptions: { resourceLimits: { maxFrameBytes: 333 } },
      });
    }).toThrow("clientLimits must be a valid resource-limit object.");
  });

  it("retains only the single-interaction signal without processing deadline", () => {
    const controller = new AbortController();
    const interactionOptions: InteractionOptionsData = {
      signal: controller.signal,
      deadline: 1_800_000_000_000,
      includeRawResponse: true,
    };
    const resolved = mergeInteractionConfiguration({
      ...baseInput,
      interactionOptions,
    });

    // Signal is retained by identity; deadline and raw-response data remain for
    // their dedicated consumers and do not expand this five-field snapshot.
    expect(resolved.signal).toBe(controller.signal);
    expect(Object.keys(resolved)).toEqual([
      "target",
      "serviceAccess",
      "compatibilityPolicy",
      "resourceLimits",
      "signal",
    ]);
  });

  it("returns a new frozen result without mutating source layers", () => {
    const clientConfiguration: ModelClientConfigurationData = {
      defaultTarget: clientTarget,
      defaultServiceAccess: clientAccess,
      defaultResourceLimits: { maxResponseBodyBytes: 110 },
    };
    const interactionOptions: InteractionOptionsData = {
      serviceAccessOverride: interactionAccess,
      resourceLimits: { maxFrameBytes: 333 },
    };
    const input = {
      ...baseInput,
      clientConfiguration,
      interactionOptions,
    };
    const first = mergeInteractionConfiguration(input);
    const second = mergeInteractionConfiguration(input);

    // Equal source values produce separate stable snapshots, and neither partial
    // layer receives resolved fallbacks or data selected from another tier.
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Reflect.set(first, "signal", new AbortController().signal)).toBe(false);
    expect(clientConfiguration).toEqual({
      defaultTarget: clientTarget,
      defaultServiceAccess: clientAccess,
      defaultResourceLimits: { maxResponseBodyBytes: 110 },
    });
    expect(interactionOptions).toEqual({
      serviceAccessOverride: interactionAccess,
      resourceLimits: { maxFrameBytes: 333 },
    });
  });
});
