// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { ModelDescriptor } from "./model-descriptor.js";
import { NamedModel } from "./named-model.js";

it("implements the public model descriptor contract", () => {
  // Verify both instance compatibility and the one-argument constructor surface
  // without widening the class to accept metadata or adjacent model concerns.
  expectTypeOf<NamedModel>().toMatchTypeOf<ModelDescriptor>();
  expectTypeOf(NamedModel).constructorParameters.toEqualTypeOf<[name: string]>();
});

it("creates the complete default state from only a model name", () => {
  const model = new NamedModel("example-model");

  // The model name is the only supplied identity; always-present containers are
  // empty while optional descriptive fields remain truly absent.
  expect(model.name).toBe("example-model");
  expect(model.metadata).toEqual({});
  expect(model.extensions).toEqual({});
  expect(Object.hasOwn(model, "displayName")).toBe(false);
  expect(Object.hasOwn(model, "family")).toBe(false);
  expect(Object.hasOwn(model, "version")).toBe(false);
  expect(model.displayName).toBeUndefined();
  expect(model.family).toBeUndefined();
  expect(model.version).toBeUndefined();
});

it("preserves the supplied name without normalization or inference", () => {
  const name = " vendor/model-family-v2 ";
  const model = new NamedModel(name);

  // Keep deliberate surrounding whitespace and identifier-like segments intact
  // to prove construction does not silently validate, trim, or parse input.
  expect(model.name).toBe(name);
  expect(model.family).toBeUndefined();
  expect(model.version).toBeUndefined();
});

it("freezes the instance and both default maps at runtime", () => {
  const model = new NamedModel("example-model");

  // Freeze all exposed default state so JavaScript callers cannot bypass the
  // TypeScript readonly declarations through reflective assignment.
  expect(Object.isFrozen(model)).toBe(true);
  expect(Object.isFrozen(model.metadata)).toBe(true);
  expect(Object.isFrozen(model.extensions)).toBe(true);
  expect(Reflect.set(model, "name", "changed")).toBe(false);
  expect(Reflect.set(model.metadata, "mutable", true)).toBe(false);
  expect(Reflect.set(model.extensions, "vendor.mutable", true)).toBe(false);
  expect(model.name).toBe("example-model");
  expect(model.metadata).toEqual({});
  expect(model.extensions).toEqual({});
});

it("keeps empty defaults safe across model instances", () => {
  const first = new NamedModel("first-model");
  const second = new NamedModel("second-model");

  // A failed write through one immutable default must leave every other model's
  // defaults empty without making object identity part of the public contract.
  expect(Reflect.set(first.metadata, "leaked", true)).toBe(false);
  expect(first.name).toBe("first-model");
  expect(second.name).toBe("second-model");
  expect(second.metadata).toEqual({});
  expect(second.extensions).toEqual({});
});

it("prevents field replacement at compile time", () => {
  const proveReadonly = (model: NamedModel): void => {
    // Exercise every stored public field only for compile-time verification;
    // the helper remains uncalled so no mutation reaches runtime.
    // @ts-expect-error The protocol model name cannot be replaced.
    model.name = "changed";
    // @ts-expect-error The metadata map reference cannot be replaced.
    model.metadata = {};
    // @ts-expect-error The extension map reference cannot be replaced.
    model.extensions = {};
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
