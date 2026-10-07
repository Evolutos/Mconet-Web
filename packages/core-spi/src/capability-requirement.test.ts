// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

import type { CapabilityRequirement } from "./capability-requirement.js";

it("defines only an open capability identity and explicit requiredness", () => {
  // Exact equality prevents providers, components, constraints, diagnostics,
  // compatibility decisions, and resolution state from entering the request.
  expectTypeOf<CapabilityRequirement>().toEqualTypeOf<{
    readonly capabilityId: OpenIdentifier;
    readonly required: boolean;
  }>();
});

it("keeps required and optional capability decisions explicit", () => {
  const required: CapabilityRequirement = {
    capabilityId: "model.text.output",
    required: true,
  };
  const optional: CapabilityRequirement = {
    capabilityId: "vendor.response.citations",
    required: false,
  };

  // Both strengths use the same open contract; this data layer does not infer
  // requiredness from capability vocabulary or reject integration-defined IDs.
  expect(required).toEqual({ capabilityId: "model.text.output", required: true });
  expect(optional).toEqual({
    capabilityId: "vendor.response.citations",
    required: false,
  });
});

it("requires the boolean decision instead of treating omission as optional", () => {
  expectTypeOf<{
    readonly capabilityId: OpenIdentifier;
  }>().not.toMatchTypeOf<CapabilityRequirement>();
  expectTypeOf<{
    readonly capabilityId: OpenIdentifier;
    readonly required: "optional";
  }>().not.toMatchTypeOf<CapabilityRequirement>();
});

it("prevents replacement of capability identity or requiredness", () => {
  const proveReadonly = (requirement: CapabilityRequirement): void => {
    // The helper is compiled but never invoked, preserving runtime fixtures while
    // strict TypeScript checks both immutable public fields.
    // @ts-expect-error Capability identity remains stable during resolution.
    requirement.capabilityId = "replacement.capability";
    // @ts-expect-error Requirement strength remains stable during resolution.
    requirement.required = false;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
