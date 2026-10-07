// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ComponentDescriptor } from "./component-descriptor.js";
import type { ComponentRole } from "./component-role.js";
import type { RuntimeComponent } from "./runtime-component.js";
import type { SelectedComponent } from "./selected-component.js";

it("defines only an immutable role component and descriptor snapshot", () => {
  // Exact equality prevents candidate lists, component IDs, priorities, owners,
  // factories, or resolver state from entering the completed selection value.
  expectTypeOf<SelectedComponent>().toEqualTypeOf<{
    readonly role: ComponentRole;
    readonly component: RuntimeComponent;
    readonly descriptor: ComponentDescriptor;
  }>();
});

it("preserves the selected role component and descriptor identities", () => {
  const role: ComponentRole = { id: "transport.unary" };
  const descriptor: ComponentDescriptor = {
    name: "selected-unary-transport",
    version: "1.0.0",
    capabilities: new Set(["transport.http", "transport.response.bounded"]),
    source: "application",
  };
  const component: RuntimeComponent = { descriptor };
  const selected: SelectedComponent = { role, component, descriptor };

  // Resolution retains the configured instance and the exact metadata snapshot;
  // it does not clone, wrap, reconstruct, register, or rename either value.
  expect(selected.role).toBe(role);
  expect(selected.component).toBe(component);
  expect(selected.descriptor).toBe(descriptor);
  expect(selected.component.descriptor).toBe(selected.descriptor);
});

it("allows different roles to retain distinct configured components", () => {
  const encoderDescriptor: ComponentDescriptor = {
    name: "selected-request-encoder",
    version: "1.0.0",
    capabilities: new Set(["codec.json"]),
    source: "builtin",
  };
  const transportDescriptor: ComponentDescriptor = {
    name: "selected-unary-transport",
    version: "1.0.0",
    capabilities: new Set(["transport.http"]),
    source: "application",
  };
  const encoderSelection: SelectedComponent = {
    role: { id: "codec.request.encoder" },
    component: { descriptor: encoderDescriptor },
    descriptor: encoderDescriptor,
  };
  const transportSelection: SelectedComponent = {
    role: { id: "transport.unary" },
    component: { descriptor: transportDescriptor },
    descriptor: transportDescriptor,
  };

  // Each entry represents one resolved role and never infers interchangeability
  // merely because both implementations satisfy RuntimeComponent structurally.
  expect(encoderSelection.role.id).toBe("codec.request.encoder");
  expect(transportSelection.role.id).toBe("transport.unary");
  expect(encoderSelection.component).not.toBe(transportSelection.component);
});

it("prevents replacement of snapshot fields", () => {
  const proveReadonly = (
    selected: SelectedComponent,
    role: ComponentRole,
    component: RuntimeComponent,
    descriptor: ComponentDescriptor,
  ): void => {
    // This helper remains compile-only so strict TypeScript checks the snapshot
    // without changing a selected execution component at runtime.
    // @ts-expect-error The fulfilled role cannot be replaced.
    selected.role = role;
    // @ts-expect-error The selected component instance cannot be replaced.
    selected.component = component;
    // @ts-expect-error Selection-time metadata cannot be replaced.
    selected.descriptor = descriptor;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});

it("does not contain candidates selection policy or lifecycle state", () => {
  // The fixed resolver and ownership tracker retain these separate concerns.
  expectTypeOf<SelectedComponent>().not.toHaveProperty("componentId");
  expectTypeOf<SelectedComponent>().not.toHaveProperty("candidates");
  expectTypeOf<SelectedComponent>().not.toHaveProperty("priority");
  expectTypeOf<SelectedComponent>().not.toHaveProperty("sourceTier");
  expectTypeOf<SelectedComponent>().not.toHaveProperty("ownership");
  expectTypeOf<SelectedComponent>().not.toHaveProperty("close");
});
