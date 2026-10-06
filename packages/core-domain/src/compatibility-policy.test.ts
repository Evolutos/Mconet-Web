// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { CompatibilityMode } from "./compatibility-mode.js";
import type { CompatibilityPolicy } from "./compatibility-policy.js";

it("defines only the immutable compatibility mode", () => {
  // Exact equality prevents unimplemented feature switches, behavior callbacks,
  // retry settings, or mutable extension bags from entering the value contract.
  expectTypeOf<CompatibilityPolicy>().toEqualTypeOf<{
    readonly mode: CompatibilityMode;
  }>();
});

it("accepts every standard compatibility mode", () => {
  const policies = [
    { mode: "strict" },
    { mode: "compatible" },
    { mode: "permissive" },
  ] as const satisfies readonly CompatibilityPolicy[];

  // Preserve the three public strategies as distinct values without assigning
  // their runtime behavior to this representation-only interface.
  expect(policies.map((policy) => policy.mode)).toEqual(["strict", "compatible", "permissive"]);
});

it("preserves integration-defined and future modes", () => {
  const mode: CompatibilityMode = "provider.audit_compatible";
  const policy: CompatibilityPolicy = { mode };

  // Unknown valid mode identities remain exact instead of being coerced to a
  // standard fallback or generic unknown sentinel.
  expect(policy.mode).toBe("provider.audit_compatible");
  expectTypeOf(policy.mode).toEqualTypeOf<CompatibilityMode>();
});

it("prevents replacement of the selected compatibility mode", () => {
  const proveReadonly = (policy: CompatibilityPolicy): void => {
    // Exercise the forbidden write only during type checking; this helper is
    // never invoked and cannot mutate a runtime policy object.
    // @ts-expect-error A selected policy mode is immutable for the interaction.
    policy.mode = "permissive";
  };

  // Retain the helper in the test program so strict TypeScript validation keeps
  // enforcing the readonly assignment without executing it.
  expectTypeOf(proveReadonly).toBeFunction();
});

it("rejects missing and non-string policy modes", () => {
  // The policy always names one strategy and cannot use absence, numeric flags,
  // booleans, or wrapper objects as alternate representations.
  expectTypeOf<Record<never, never>>().not.toMatchTypeOf<CompatibilityPolicy>();
  expectTypeOf<{ readonly mode: number }>().not.toMatchTypeOf<CompatibilityPolicy>();
  expectTypeOf<{ readonly mode: boolean }>().not.toMatchTypeOf<CompatibilityPolicy>();
  expectTypeOf<{
    readonly mode: { readonly value: string };
  }>().not.toMatchTypeOf<CompatibilityPolicy>();
});
