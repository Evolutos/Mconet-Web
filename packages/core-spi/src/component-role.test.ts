// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

import type { ComponentRole } from "./component-role.js";

it("defines one immutable open role identifier", () => {
  // Exact equality prevents component identity, configuration, implementation,
  // priority, lifecycle, or selection state from entering the role value.
  expectTypeOf<ComponentRole>().toEqualTypeOf<{
    readonly id: OpenIdentifier;
  }>();
});

it("represents standard execution-chain positions without instances", () => {
  const roles: readonly ComponentRole[] = [
    { id: "task.protocol-adapter" },
    { id: "codec.request.encoder" },
    { id: "codec.response.success-decoder" },
    { id: "codec.response.error-decoder" },
    { id: "transport.unary" },
  ];

  // Standard role identities remain ordinary immutable planning facts. Creating
  // them does not discover, construct, register, or prioritize any component.
  expect(roles.map((role) => role.id)).toEqual([
    "task.protocol-adapter",
    "codec.request.encoder",
    "codec.response.success-decoder",
    "codec.response.error-decoder",
    "transport.unary",
  ]);
});

it("preserves integration-defined future roles", () => {
  const id = "vendor.mode.specialized-accumulator" as OpenIdentifier;
  const role: ComponentRole = { id };

  // The wrapper retains the exact open identifier instead of coercing unknown
  // roles to a current standard value or rejecting future execution positions.
  expect(role.id).toBe(id);
});

it("keeps roles distinct from component descriptors and configuration keys", () => {
  const role: ComponentRole = { id: "transport.unary" };

  // A role is only a position name. Component metadata, instances, ownership,
  // injection fields, and selection results remain in their dedicated values.
  expect(role).toEqual({ id: "transport.unary" });
  expectTypeOf<ComponentRole>().not.toHaveProperty("descriptor");
  expectTypeOf<ComponentRole>().not.toHaveProperty("component");
  expectTypeOf<ComponentRole>().not.toHaveProperty("componentId");
  expectTypeOf<ComponentRole>().not.toHaveProperty("configurationKey");
  expectTypeOf<ComponentRole>().not.toHaveProperty("priority");
});

it("prevents replacement of the role identity", () => {
  const proveReadonly = (role: ComponentRole): void => {
    // The helper remains compile-only so strict TypeScript checks the immutable
    // identity without mutating an execution plan fixture at runtime.
    // @ts-expect-error An execution-chain role cannot change after capture.
    role.id = "replacement.role";
  };

  expectTypeOf(proveReadonly).toBeFunction();
});

it("rejects non-string role representations", () => {
  // Objects and symbols cannot act as portable role identities across packages,
  // browser realms, workers, or language implementations.
  expectTypeOf<number>().not.toMatchTypeOf<ComponentRole["id"]>();
  expectTypeOf<boolean>().not.toMatchTypeOf<ComponentRole["id"]>();
  expectTypeOf<symbol>().not.toMatchTypeOf<ComponentRole["id"]>();
  expectTypeOf<{ readonly name: string }>().not.toMatchTypeOf<ComponentRole["id"]>();
});
