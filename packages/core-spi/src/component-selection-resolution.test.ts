// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ComponentDescriptor } from "./component-descriptor.js";
import type { ComponentSelectionResolution } from "./component-selection-resolution.js";
import type { RuntimeComponent } from "./runtime-component.js";
import type { SelectedComponent } from "./selected-component.js";

/** Creates a selected-component fixture for one already resolved role. */
const createSelection = (roleId: string, componentName: string): SelectedComponent => {
  const descriptor: ComponentDescriptor = {
    name: componentName,
    version: "1.0.0",
    capabilities: new Set(),
    source: "application",
  };
  const component: RuntimeComponent = { descriptor };

  // The fixture keeps descriptor identity aligned with its component, matching
  // the invariant enforced by the resolver before it produces this result.
  return { role: { id: roleId }, component, descriptor };
};

it("defines one immutable ordered collection of selected components", () => {
  // Exact equality prevents unresolved candidates, registries, role maps,
  // priorities, diagnostics, or lifecycle state from entering the result.
  expectTypeOf<ComponentSelectionResolution>().toEqualTypeOf<{
    readonly components: readonly SelectedComponent[];
  }>();
});

it("preserves resolver order and selected snapshot identities", () => {
  const encoder = createSelection("codec.request.encoder", "selected-request-encoder");
  const decoder = createSelection("codec.response.success-decoder", "selected-success-decoder");
  const transport = createSelection("transport.unary", "selected-unary-transport");
  const components = [encoder, decoder, transport] as const;
  const resolution: ComponentSelectionResolution = { components };

  // The result retains deterministic resolver order and exact snapshot objects;
  // it does not sort, group, clone, wrap, or resolve the entries again.
  expect(resolution.components).toBe(components);
  expect(resolution.components).toEqual([encoder, decoder, transport]);
  expect(resolution.components[0]).toBe(encoder);
  expect(resolution.components[1]).toBe(decoder);
  expect(resolution.components[2]).toBe(transport);
});

it("represents a completed resolution with no selected optional roles", () => {
  const components = [] as const;
  const resolution: ComponentSelectionResolution = { components };

  // An explicit empty collection represents a completed resolution in which no
  // optional planned role produced an instance; undefined cannot mean unresolved.
  expect(resolution.components).toBe(components);
  expect(resolution.components).toEqual([]);
});

it("allows one component instance to satisfy distinct roles", () => {
  const descriptor: ComponentDescriptor = {
    name: "combined-json-codec",
    version: "1.0.0",
    capabilities: new Set(["codec.json"]),
    source: "application",
  };
  const component: RuntimeComponent = { descriptor };
  const requestEncoder: SelectedComponent = {
    role: { id: "codec.request.encoder" },
    component,
    descriptor,
  };
  const successDecoder: SelectedComponent = {
    role: { id: "codec.response.success-decoder" },
    component,
    descriptor,
  };
  const resolution: ComponentSelectionResolution = {
    components: [requestEncoder, successDecoder],
  };

  // Role uniqueness, not object uniqueness, is the invariant. A stateless object
  // may implement multiple compatible SPI roles after each role is validated.
  expect(resolution.components[0]?.component).toBe(component);
  expect(resolution.components[1]?.component).toBe(component);
  expect(resolution.components[0]?.role).not.toEqual(resolution.components[1]?.role);
});

it("prevents collection replacement and membership mutation", () => {
  const proveReadonly = (
    resolution: ComponentSelectionResolution,
    selected: SelectedComponent,
  ): void => {
    // This helper remains compile-only so strict TypeScript locks both the field
    // and ordered membership without mutating an execution snapshot.
    // @ts-expect-error The selected component collection cannot be replaced.
    resolution.components = [];
    // @ts-expect-error Readonly arrays cannot gain selected component entries.
    resolution.components.push(selected);
  };

  expectTypeOf(proveReadonly).toBeFunction();
});

it("does not expose unresolved candidates registries or selection policy", () => {
  // Candidate dispatch and deterministic precedence remain resolver concerns.
  expectTypeOf<ComponentSelectionResolution>().not.toHaveProperty("candidates");
  expectTypeOf<ComponentSelectionResolution>().not.toHaveProperty("registry");
  expectTypeOf<ComponentSelectionResolution>().not.toHaveProperty("componentIds");
  expectTypeOf<ComponentSelectionResolution>().not.toHaveProperty("priority");
  expectTypeOf<ComponentSelectionResolution>().not.toHaveProperty("resolve");
  expectTypeOf<ComponentSelectionResolution>().not.toHaveProperty("diagnostics");
});
