// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

import type { ComponentOwnership } from "./component-ownership.js";

it("accepts the two standard component ownership identities", () => {
  const values = ["builtin", "application"] as const satisfies readonly ComponentOwnership[];

  // Standard values distinguish resources created by the SDK from resources
  // supplied and retained by the application without adding close behavior.
  expect(values).toEqual(["builtin", "application"]);
});

it("retains future ownership identities through the open arm", () => {
  const delegated = "platform.delegated" as OpenIdentifier;
  const ownership: ComponentOwnership = delegated;

  // Preserve the exact open identifier so later runtimes can add ownership
  // policies without mapping an unknown value to either current standard.
  expect(ownership).toBe(delegated);
});

it("remains assignable to the shared open identifier boundary", () => {
  // Every ownership identity uses the portable identifier grammar; the branded
  // open arm keeps literal completion without closing the public type.
  expectTypeOf<ComponentOwnership>().toMatchTypeOf<OpenIdentifier>();
  expectTypeOf<"builtin">().toMatchTypeOf<ComponentOwnership>();
  expectTypeOf<"application">().toMatchTypeOf<ComponentOwnership>();
  expectTypeOf<OpenIdentifier>().toMatchTypeOf<ComponentOwnership>();
});

it("does not accept non-string lifecycle representations", () => {
  // Lifecycle objects and booleans would mix resource behavior with the stable
  // ownership identity and cannot cross this data-only type boundary.
  expectTypeOf<boolean>().not.toMatchTypeOf<ComponentOwnership>();
  expectTypeOf<{ readonly close: () => void }>().not.toMatchTypeOf<ComponentOwnership>();
  expectTypeOf<symbol>().not.toMatchTypeOf<ComponentOwnership>();
});
