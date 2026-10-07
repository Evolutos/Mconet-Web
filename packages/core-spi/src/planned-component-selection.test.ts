// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

import type { ComponentRole } from "./component-role.js";
import type { PlannedComponentSelection } from "./planned-component-selection.js";

it("defines only immutable planned role requirements", () => {
  // Exact equality prevents component instances, descriptors, candidates,
  // ownership, priority, or resolution status from entering plan requirements.
  expectTypeOf<PlannedComponentSelection>().toEqualTypeOf<{
    readonly role: ComponentRole;
    readonly required: boolean;
    readonly requiredCapabilities: ReadonlySet<OpenIdentifier>;
  }>();
});

it("preserves role identity and required capability membership", () => {
  const role: ComponentRole = { id: "stream.framer-factory" };
  const requiredCapabilities: ReadonlySet<OpenIdentifier> = new Set([
    "stream.framing.server-events",
    "stream.backpressure.bounded",
  ]);
  const selection: PlannedComponentSelection = {
    role,
    required: true,
    requiredCapabilities,
  };

  // The plan retains declared objects exactly and performs no component lookup,
  // capability expansion, sorting, defaulting, or construction.
  expect(selection.role).toBe(role);
  expect(selection.required).toBe(true);
  expect(selection.requiredCapabilities).toBe(requiredCapabilities);
  expect([...selection.requiredCapabilities]).toEqual([
    "stream.framing.server-events",
    "stream.backpressure.bounded",
  ]);
});

it("distinguishes required and optional component roles", () => {
  const role: ComponentRole = { id: "stream.event-mapper" };
  const requiredSelection: PlannedComponentSelection = {
    role,
    required: true,
    requiredCapabilities: new Set(),
  };
  const optionalSelection: PlannedComponentSelection = {
    role,
    required: false,
    requiredCapabilities: new Set(),
  };

  // The boolean changes only missing-component failure policy; it does not alter
  // role identity, capability requirements, or component priority.
  expect(requiredSelection.required).toBe(true);
  expect(optionalSelection.required).toBe(false);
  expect(requiredSelection.role).toBe(optionalSelection.role);
});

it("requires an explicit capability set even when it is empty", () => {
  const requiredCapabilities: ReadonlySet<OpenIdentifier> = new Set();
  const selection: PlannedComponentSelection = {
    role: { id: "transport.unary" },
    required: true,
    requiredCapabilities,
  };

  // Explicit emptiness means this completed plan entry has no extra capability
  // constraint; undefined cannot ambiguously mean unresolved requirements.
  expect(selection.requiredCapabilities).toBe(requiredCapabilities);
  expect(selection.requiredCapabilities.size).toBe(0);
  expectTypeOf<{
    readonly role: ComponentRole;
    readonly required: boolean;
  }>().not.toMatchTypeOf<PlannedComponentSelection>();
});

it("prevents mutation of role policy and capability membership", () => {
  const proveReadonly = (
    selection: PlannedComponentSelection,
    role: ComponentRole,
    capabilities: ReadonlySet<OpenIdentifier>,
  ): void => {
    // This helper remains compile-only so strict TypeScript locks the complete
    // planning entry without mutating a live execution plan fixture.
    // @ts-expect-error The planned role cannot be replaced.
    selection.role = role;
    // @ts-expect-error Required/optional policy cannot be changed.
    selection.required = false;
    // @ts-expect-error The capability set cannot be replaced.
    selection.requiredCapabilities = capabilities;
    // @ts-expect-error ReadonlySet exposes no capability mutation.
    selection.requiredCapabilities.add("replacement.capability");
  };

  expectTypeOf(proveReadonly).toBeFunction();
});

it("does not contain a selected component or resolver state", () => {
  // Planning requirements remain distinct from candidates and resolved snapshots.
  expectTypeOf<PlannedComponentSelection>().not.toHaveProperty("component");
  expectTypeOf<PlannedComponentSelection>().not.toHaveProperty("descriptor");
  expectTypeOf<PlannedComponentSelection>().not.toHaveProperty("candidates");
  expectTypeOf<PlannedComponentSelection>().not.toHaveProperty("selected");
  expectTypeOf<PlannedComponentSelection>().not.toHaveProperty("priority");
  expectTypeOf<PlannedComponentSelection>().not.toHaveProperty("ownership");
});
