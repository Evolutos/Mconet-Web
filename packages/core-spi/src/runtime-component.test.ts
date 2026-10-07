// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ComponentDescriptor } from "./component-descriptor.js";
import type { RuntimeComponent } from "./runtime-component.js";

it("requires only one immutable component descriptor", () => {
  // Exact equality prevents universal execute, supports, close, ID, priority,
  // registry, configuration, or request-state members from entering the base SPI.
  expectTypeOf<RuntimeComponent>().toEqualTypeOf<{
    readonly descriptor: ComponentDescriptor;
  }>();
});

it("retains the concrete component descriptor by identity", () => {
  const descriptor: ComponentDescriptor = {
    name: "Example runtime component",
    version: "1.0.0",
    capabilities: new Set(["example.capability"]),
    source: "application",
  };
  const component: RuntimeComponent = { descriptor };

  // The base abstraction neither copies metadata nor supplies behavior. Each
  // concrete SPI extends this shape with its own narrowly typed methods later.
  expect(component.descriptor).toBe(descriptor);
  expect(component).toEqual({ descriptor });
});

it("prevents replacement of the component descriptor", () => {
  const proveReadonly = (component: RuntimeComponent, replacement: ComponentDescriptor): void => {
    // This helper is compiled but never invoked, locking the readonly reference
    // without mutating a runtime component fixture.
    // @ts-expect-error A runtime component retains its declared descriptor.
    component.descriptor = replacement;
  };

  // Retaining the helper ensures strict TypeScript evaluates the forbidden
  // assignment while the runtime test remains side-effect free.
  expectTypeOf(proveReadonly).toBeFunction();
});
