// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import { ModelInteractionError, type OpenIdentifier } from "@evolutos/mconet-core-domain";
import type {
  CapabilityRequirement,
  CapabilityResolution,
  ComponentDescriptor,
  ComponentSelectionResolution,
  RuntimeComponent,
  SelectedComponent,
} from "@evolutos/mconet-core-spi";

import { resolveRequiredCapabilities } from "./resolve-required-capabilities.js";

it("exposes one exact required-capability resolver signature", () => {
  // The resolver receives declared requirements and already selected component
  // facts only; providers, policy, request data, and optional diagnostics are absent.
  expectTypeOf(resolveRequiredCapabilities).toEqualTypeOf<
    (
      input: Readonly<{
        readonly requirements: readonly CapabilityRequirement[];
        readonly componentSelection: ComponentSelectionResolution;
      }>,
    ) => CapabilityResolution
  >();
});

it("resolves required capabilities in declaration order from descriptor snapshots", () => {
  const requiredJson: CapabilityRequirement = {
    capabilityId: "codec.json",
    required: true,
  };
  const optionalMetrics: CapabilityRequirement = {
    capabilityId: "response.metrics",
    required: false,
  };
  const requiredHttp: CapabilityRequirement = {
    capabilityId: "transport.http",
    required: true,
  };
  const duplicateJson: CapabilityRequirement = {
    capabilityId: "codec.json",
    required: true,
  };
  const requirements = Object.freeze([requiredJson, optionalMetrics, requiredHttp, duplicateJson]);
  const components = Object.freeze([
    createSelectedComponent("codec.response", ["codec.json"]),
    createSelectedComponent("transport.unary", ["transport.http", "transport.bounded"]),
  ]);
  const componentSelection: ComponentSelectionResolution = Object.freeze({ components });

  const resolution = resolveRequiredCapabilities({ requirements, componentSelection });

  // Required declarations retain order, duplicates, and object identity. The
  // optional requirement is intentionally deferred rather than reported here.
  expect(resolution.satisfied).toEqual([requiredJson, requiredHttp, duplicateJson]);
  expect(resolution.satisfied[0]).toBe(requiredJson);
  expect(resolution.satisfied[1]).toBe(requiredHttp);
  expect(resolution.satisfied[2]).toBe(duplicateJson);
  expect(resolution.optionalUnsupported).toEqual([]);
  expect(resolution.diagnostics).toEqual([]);
  expect(Object.isFrozen(resolution)).toBe(true);
  expect(Object.isFrozen(resolution.satisfied)).toBe(true);
  expect(Object.isFrozen(resolution.optionalUnsupported)).toBe(true);
  expect(Object.isFrozen(resolution.diagnostics)).toBe(true);
  expect(requirements).toEqual([requiredJson, optionalMetrics, requiredHttp, duplicateJson]);
  expect(componentSelection.components).toBe(components);
});

it("ignores optional requirements even when selected components provide them", () => {
  const optionalSupported: CapabilityRequirement = {
    capabilityId: "response.metrics",
    required: false,
  };
  const optionalUnsupported: CapabilityRequirement = {
    capabilityId: "response.citations",
    required: false,
  };
  const componentSelection: ComponentSelectionResolution = {
    components: [createSelectedComponent("adapter", ["response.metrics"])],
  };

  // Optional support and diagnostics are a separate step. This resolver returns
  // only required facts and does not partially implement the next algorithm.
  expect(
    resolveRequiredCapabilities({
      requirements: [optionalSupported, optionalUnsupported],
      componentSelection,
    }),
  ).toEqual({ satisfied: [], optionalUnsupported: [], diagnostics: [] });
});

it("returns independent frozen empty collections when no requirements exist", () => {
  const first = resolveRequiredCapabilities({
    requirements: [],
    componentSelection: { components: [] },
  });
  const second = resolveRequiredCapabilities({
    requirements: [],
    componentSelection: { components: [] },
  });

  // Each invocation owns its immutable result collections; semantic roles do not
  // alias one another or a mutable shared singleton.
  expect(first).toEqual({ satisfied: [], optionalUnsupported: [], diagnostics: [] });
  expect(first).not.toBe(second);
  expect(first.satisfied).not.toBe(first.optionalUnsupported);
  expect(first.optionalUnsupported).not.toBe(first.diagnostics);
  expect(first.satisfied).not.toBe(second.satisfied);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(second)).toBe(true);
});

it("rejects the first unsupported required capability without returning partial facts", () => {
  const supported: CapabilityRequirement = {
    capabilityId: "codec.json",
    required: true,
  };
  const firstMissing: CapabilityRequirement = {
    capabilityId: "transport.grpc",
    required: true,
  };
  const secondMissing: CapabilityRequirement = {
    capabilityId: "transport.websocket",
    required: true,
  };
  const error = captureInteractionError(() => {
    // The first requirement succeeds internally, but a later required miss makes
    // the entire resolution fail; no partial CapabilityResolution escapes.
    resolveRequiredCapabilities({
      requirements: [supported, firstMissing, secondMissing],
      componentSelection: {
        components: [createSelectedComponent("codec.request", ["codec.json"])],
      },
    });
  });

  expect(error).toMatchObject({
    category: "unsupported_feature",
    phase: "resolution",
    code: "unsupported_capability",
    diagnostics: [
      {
        code: "unsupported_capability",
        severity: "error",
        phase: "resolution",
        details: { capabilityId: firstMissing.capabilityId },
      },
    ],
  });
  expect(error.diagnostics[0]?.details).not.toHaveProperty(
    "capabilityId",
    secondMissing.capabilityId,
  );
});

it("rejects a required capability when no component was selected", () => {
  const requirement: CapabilityRequirement = {
    capabilityId: "codec.json",
    required: true,
  };
  const error = captureInteractionError(() => {
    // Absence of selected components cannot be repaired by unselected defaults,
    // registries, or capability inference.
    resolveRequiredCapabilities({
      requirements: [requirement],
      componentSelection: { components: [] },
    });
  });

  expect(error.code).toBe("unsupported_capability");
  expect(error.diagnostics[0]?.details).toEqual({ capabilityId: requirement.capabilityId });
});

/** Creates a selected component whose captured descriptor is the only readable metadata. */
function createSelectedComponent(
  roleId: OpenIdentifier,
  capabilityIds: readonly OpenIdentifier[],
): SelectedComponent {
  const descriptor: ComponentDescriptor = {
    name: `${roleId}-fixture`,
    version: "1.0.0",
    capabilities: new Set(capabilityIds),
    source: "plugin",
  };
  const component: RuntimeComponent = {
    get descriptor(): never {
      // Resolution must use the explicit descriptor snapshot in SelectedComponent,
      // not reopen mutable or accessor-backed metadata on the live implementation.
      throw new Error("live component descriptor must not be read");
    },
  };

  return {
    role: { id: roleId },
    component,
    descriptor,
  };
}

/** Captures one expected classified capability-resolution failure safely. */
function captureInteractionError(action: () => void): ModelInteractionError {
  try {
    // Invoke once so requirement order and the reported first missing capability
    // remain deterministic.
    action();
  } catch (error) {
    if (error instanceof ModelInteractionError) {
      return error;
    }
    // Keep unexpected failure identity as the test assertion cause without casting.
    throw new Error("Expected ModelInteractionError.", { cause: error });
  }

  throw new Error("Expected required capability resolution to fail.");
}
