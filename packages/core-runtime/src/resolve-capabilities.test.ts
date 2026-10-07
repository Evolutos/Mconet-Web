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

import { resolveCapabilities } from "./resolve-capabilities.js";

it("exposes one exact complete capability resolver signature", () => {
  // The fixed resolver observes requirements and selected descriptors only; no
  // policy, provider registry, network probe, or caller-supplied resolver enters.
  expectTypeOf(resolveCapabilities).toEqualTypeOf<
    (
      input: Readonly<{
        readonly requirements: readonly CapabilityRequirement[];
        readonly componentSelection: ComponentSelectionResolution;
      }>,
    ) => CapabilityResolution
  >();
});

it("preserves global order while classifying supported and optional capabilities", () => {
  const requiredJson = createRequirement("codec.json", true);
  const optionalMetrics = createRequirement("response.metrics", false);
  const optionalCitations = createRequirement("response.citations", false);
  const requiredHttp = createRequirement("transport.http", true);
  const optionalTracing = createRequirement("monitoring.trace", false);
  const requirements = Object.freeze([
    requiredJson,
    optionalMetrics,
    optionalCitations,
    requiredHttp,
    optionalTracing,
  ]);
  const components = Object.freeze([
    createSelectedComponent("codec.response", ["codec.json", "response.metrics"]),
    createSelectedComponent("transport.unary", ["transport.http", "monitoring.trace"]),
  ]);
  const componentSelection: ComponentSelectionResolution = Object.freeze({ components });

  const resolution = resolveCapabilities({ requirements, componentSelection });

  // Satisfied facts remain in their original interleaved positions after the
  // unsupported optional item is removed into its dedicated ordered collection.
  expect(resolution.satisfied).toEqual([
    requiredJson,
    optionalMetrics,
    requiredHttp,
    optionalTracing,
  ]);
  expect(resolution.satisfied[0]).toBe(requiredJson);
  expect(resolution.satisfied[1]).toBe(optionalMetrics);
  expect(resolution.satisfied[2]).toBe(requiredHttp);
  expect(resolution.satisfied[3]).toBe(optionalTracing);
  expect(resolution.optionalUnsupported).toEqual([optionalCitations]);
  expect(resolution.optionalUnsupported[0]).toBe(optionalCitations);
  expect(resolution.diagnostics).toEqual([
    {
      code: "unsupported_capability",
      severity: "warning",
      phase: "resolution",
      message: "An optional interaction capability is unavailable.",
      details: { capabilityId: optionalCitations.capabilityId },
    },
  ]);
  expect(Object.isFrozen(resolution)).toBe(true);
  expect(Object.isFrozen(resolution.satisfied)).toBe(true);
  expect(Object.isFrozen(resolution.optionalUnsupported)).toBe(true);
  expect(Object.isFrozen(resolution.diagnostics)).toBe(true);
  expect(Object.isFrozen(resolution.diagnostics[0])).toBe(true);
  expect(Object.isFrozen(resolution.diagnostics[0]?.details)).toBe(true);
  expect(requirements).toEqual([
    requiredJson,
    optionalMetrics,
    optionalCitations,
    requiredHttp,
    optionalTracing,
  ]);
  expect(componentSelection.components).toBe(components);
});

it("retains duplicate unsupported optional requirements and warning order", () => {
  const first = createRequirement("response.citations", false);
  const second = createRequirement("response.citations", false);
  const third = createRequirement("response.logprobs", false);

  const resolution = resolveCapabilities({
    requirements: [first, second, third],
    componentSelection: { components: [] },
  });

  // Each declaration is a distinct observation even when IDs repeat. No set
  // conversion may collapse source requirements or their corresponding warnings.
  expect(resolution.satisfied).toEqual([]);
  expect(resolution.optionalUnsupported).toEqual([first, second, third]);
  expect(resolution.optionalUnsupported[0]).toBe(first);
  expect(resolution.optionalUnsupported[1]).toBe(second);
  expect(resolution.diagnostics.map((diagnostic) => diagnostic.details)).toEqual([
    { capabilityId: "response.citations" },
    { capabilityId: "response.citations" },
    { capabilityId: "response.logprobs" },
  ]);
});

it("fails required resolution before exposing optional observations", () => {
  const optionalMissing = createRequirement("response.citations", false);
  const requiredMissing = createRequirement("transport.grpc", true);
  const trailingOptional = createRequirement("response.metrics", false);
  const error = captureInteractionError(() => {
    // The complete resolver delegates fail-fast required validation before it
    // creates optionalUnsupported or warning arrays.
    resolveCapabilities({
      requirements: [optionalMissing, requiredMissing, trailingOptional],
      componentSelection: { components: [] },
    });
  });

  expect(error).toMatchObject({
    category: "unsupported_feature",
    phase: "resolution",
    code: "unsupported_capability",
    diagnostics: [
      {
        severity: "error",
        details: { capabilityId: requiredMissing.capabilityId },
      },
    ],
  });
  expect(error.diagnostics).toHaveLength(1);
});

it("returns independent frozen empty snapshots for no requirements", () => {
  const first = resolveCapabilities({ requirements: [], componentSelection: { components: [] } });
  const second = resolveCapabilities({ requirements: [], componentSelection: { components: [] } });

  // Empty results are explicit per-call facts, not aliases to one another or to a
  // shared collection used for multiple semantic fields.
  expect(first).toEqual({ satisfied: [], optionalUnsupported: [], diagnostics: [] });
  expect(first).not.toBe(second);
  expect(first.satisfied).not.toBe(first.optionalUnsupported);
  expect(first.optionalUnsupported).not.toBe(first.diagnostics);
  expect(first.satisfied).not.toBe(second.satisfied);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.satisfied)).toBe(true);
  expect(Object.isFrozen(first.optionalUnsupported)).toBe(true);
  expect(Object.isFrozen(first.diagnostics)).toBe(true);
});

/** Creates one immutable capability requirement fixture. */
function createRequirement(capabilityId: OpenIdentifier, required: boolean): CapabilityRequirement {
  // Freeze caller-owned input so successful resolution also proves it never
  // rewrites identity or requiredness.
  return Object.freeze({ capabilityId, required });
}

/** Creates one selected component with an unreadable live descriptor. */
function createSelectedComponent(
  roleId: OpenIdentifier,
  capabilityIds: readonly OpenIdentifier[],
): SelectedComponent {
  const descriptor: ComponentDescriptor = Object.freeze({
    name: `${roleId}-fixture`,
    version: "1.0.0",
    capabilities: new Set(capabilityIds),
    source: "plugin",
  });
  const component: RuntimeComponent = {
    get descriptor(): never {
      // Capability membership must use the selected descriptor snapshot and never
      // reopen accessor-backed metadata on the implementation.
      throw new Error("live component descriptor must not be read");
    },
  };

  return Object.freeze({ role: { id: roleId }, component, descriptor });
}

/** Captures one expected required-capability failure from complete resolution. */
function captureInteractionError(action: () => void): ModelInteractionError {
  try {
    // Invoke once so fail-fast ordering and the emitted error stay deterministic.
    action();
  } catch (error) {
    if (error instanceof ModelInteractionError) {
      return error;
    }
    // Preserve unexpected implementation failures as test assertion causes.
    throw new Error("Expected ModelInteractionError.", { cause: error });
  }

  throw new Error("Expected complete capability resolution to fail.");
}
