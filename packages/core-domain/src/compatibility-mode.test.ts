// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { CompatibilityMode } from "./compatibility-mode.js";

/** Standard modes whose semantics are defined by the public architecture. */
const standardCompatibilityModes = [
  "strict",
  "compatible",
  "permissive",
] as const satisfies readonly CompatibilityMode[];

it("includes every standard compatibility mode as a literal", () => {
  // Extract the standard branch to prove all three documented literals remain
  // represented without relying only on broad string assignability.
  expectTypeOf<
    Extract<CompatibilityMode, (typeof standardCompatibilityModes)[number]>
  >().toEqualTypeOf<(typeof standardCompatibilityModes)[number]>();

  // Keep a runtime assertion so the test also guards the complete vocabulary
  // if a standard value is accidentally removed from the fixture.
  expect(standardCompatibilityModes).toHaveLength(3);
});

it("preserves integration-defined and future compatibility modes", () => {
  // Verify both a literal integration namespace and an ordinary dynamic string
  // remain assignable, which is the required forward-compatibility behavior.
  const integrationMode = "provider.lossless_extension";
  const dynamicMode: string = integrationMode;
  const modes: readonly CompatibilityMode[] = [integrationMode, dynamicMode];

  expectTypeOf<string>().toMatchTypeOf<CompatibilityMode>();
  expect(modes).toEqual([integrationMode, dynamicMode]);
});

it("rejects non-string compatibility mode representations", () => {
  // Compatibility modes are identifiers rather than numeric flags, booleans,
  // null sentinels, or wrapper objects.
  expectTypeOf<number>().not.toMatchTypeOf<CompatibilityMode>();
  expectTypeOf<boolean>().not.toMatchTypeOf<CompatibilityMode>();
  expectTypeOf<null>().not.toMatchTypeOf<CompatibilityMode>();
  expectTypeOf<{ readonly mode: string }>().not.toMatchTypeOf<CompatibilityMode>();
});
