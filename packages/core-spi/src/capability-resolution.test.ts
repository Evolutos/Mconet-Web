// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Diagnostic } from "@evolutos/mconet-core-domain";

import type { CapabilityRequirement } from "./capability-requirement.js";
import type { CapabilityResolution } from "./capability-resolution.js";

it("defines only immutable resolved capability facts", () => {
  // Exact equality prevents mutable providers, component instances, resolver
  // actions, retries, requests, or hidden selection state from entering results.
  expectTypeOf<CapabilityResolution>().toEqualTypeOf<{
    readonly satisfied: readonly CapabilityRequirement[];
    readonly optionalUnsupported: readonly CapabilityRequirement[];
    readonly diagnostics: readonly Diagnostic[];
  }>();
});

it("preserves requirement identity and declared result order", () => {
  const requiredText: CapabilityRequirement = {
    capabilityId: "model.text.output",
    required: true,
  };
  const optionalUsage: CapabilityRequirement = {
    capabilityId: "model.usage.tokens",
    required: false,
  };
  const optionalCitations: CapabilityRequirement = {
    capabilityId: "vendor.response.citations",
    required: false,
  };
  const diagnostic: Diagnostic = {
    code: "unsupported_capability",
    severity: "warning",
    phase: "resolution",
    message: "An optional capability is unavailable.",
    path: "capabilities[2]",
  };
  const satisfied = [requiredText, optionalUsage] as const;
  const optionalUnsupported = [optionalCitations] as const;
  const diagnostics = [diagnostic] as const;
  const resolution: CapabilityResolution = {
    satisfied,
    optionalUnsupported,
    diagnostics,
  };

  // The value records existing facts without sorting, copying, synthesizing a
  // provider, or replacing requirements with bare IDs.
  expect(resolution.satisfied).toBe(satisfied);
  expect(resolution.satisfied).toEqual([requiredText, optionalUsage]);
  expect(resolution.optionalUnsupported).toBe(optionalUnsupported);
  expect(resolution.optionalUnsupported[0]).toBe(optionalCitations);
  expect(resolution.diagnostics).toBe(diagnostics);
  expect(resolution.diagnostics[0]).toBe(diagnostic);
});

it("represents a successful resolution with no capability observations", () => {
  const resolution: CapabilityResolution = {
    satisfied: [],
    optionalUnsupported: [],
    diagnostics: [],
  };

  // Empty ordered collections remain explicit; the interface does not create a
  // default singleton or infer requirements from selected components.
  expect(resolution).toEqual({
    satisfied: [],
    optionalUnsupported: [],
    diagnostics: [],
  });
});

it("prevents replacement or mutation through result collection types", () => {
  const proveReadonly = (
    resolution: CapabilityResolution,
    requirement: CapabilityRequirement,
    diagnostic: Diagnostic,
  ): void => {
    // This helper remains compile-only so strict TypeScript can lock every result
    // collection and its membership surface without mutating runtime fixtures.
    // @ts-expect-error Satisfied results cannot be replaced.
    resolution.satisfied = [];
    // @ts-expect-error Unsupported optional results cannot be replaced.
    resolution.optionalUnsupported = [];
    // @ts-expect-error Resolution diagnostics cannot be replaced.
    resolution.diagnostics = [];
    // @ts-expect-error Readonly satisfied collections cannot gain members.
    resolution.satisfied.push(requirement);
    // @ts-expect-error Readonly optional collections cannot gain members.
    resolution.optionalUnsupported.push(requirement);
    // @ts-expect-error Readonly diagnostic collections cannot gain members.
    resolution.diagnostics.push(diagnostic);
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
