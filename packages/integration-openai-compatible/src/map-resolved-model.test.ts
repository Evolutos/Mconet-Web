// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { isModelDescriptor } from "@evolutos/mconet-core-domain";

import { mapWireModelToDomain } from "./map-resolved-model.js";

it("returns undefined when the service omits the model", () => {
  expect(mapWireModelToDomain(undefined)).toBeUndefined();
});

it("keeps a reported name exactly and does not infer family or version", () => {
  const model = mapWireModelToDomain("gpt-4o-2024-08-06");

  expect(isModelDescriptor(model)).toBe(true);
  expect(model).toEqual({
    name: "gpt-4o-2024-08-06",
    metadata: {},
    extensions: {},
  });
  expect(Object.hasOwn(model as object, "family")).toBe(false);
  expect(Object.hasOwn(model as object, "version")).toBe(false);
  expect(Object.hasOwn(model as object, "displayName")).toBe(false);
  expect(Object.isFrozen(model)).toBe(true);
});

it("keeps an empty reported name distinct from omission", () => {
  const model = mapWireModelToDomain("");

  expect(model).toMatchObject({ name: "" });
  expect(model).not.toBeUndefined();
});

it("rejects a model value that is not a string", () => {
  expect(() => mapWireModelToDomain(1 as unknown as string)).toThrow(TypeError);
});
