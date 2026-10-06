// Copyright © 2026 Mcont.

import { beforeAll, describe, expect, it } from "vitest";

import { isModelDescriptor } from "../../packages/core-domain/src/model-descriptor.js";
import { loadSchemaById } from "../schema-loader.js";
import { SchemaValidatorAdapter } from "../schema-validator-adapter.js";

/** Stable identifier of the language-neutral ModelDescriptor Schema. */
const modelDescriptorSchemaId = "https://schemas.evolutos.com/mconet/model/descriptor";

/** Schema document loaded from the committed registry before conformance cases run. */
let modelDescriptorSchema: Readonly<Record<string, unknown>>;

/** Strict compiled validator reused by every ModelDescriptor conformance case. */
let schemaValidator: SchemaValidatorAdapter;

beforeAll(async () => {
  // Resolve through the production loader so identifier discovery and Schema
  // compilation are both exercised against the committed registry artifact.
  modelDescriptorSchema = await loadSchemaById(modelDescriptorSchemaId);
  schemaValidator = new SchemaValidatorAdapter(modelDescriptorSchema);
});

describe("ModelDescriptor Schema", () => {
  it("declares the stable identity and complete top-level contract", () => {
    // Inspect the loaded immutable document so accidental dialect, identity,
    // required-member, or unknown-field policy drift fails explicitly.
    expect(modelDescriptorSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(modelDescriptorSchema.$id).toBe(modelDescriptorSchemaId);
    expect(modelDescriptorSchema.required).toEqual(["name", "metadata", "extensions"]);
    expect(modelDescriptorSchema.additionalProperties).toBe(true);
    expect(Object.isFrozen(modelDescriptorSchema)).toBe(true);
  });

  it.each([
    {
      label: "minimal descriptor with an unconstrained string name",
      value: {
        name: "",
        metadata: {},
        extensions: {},
      },
    },
    {
      label: "complete descriptor with recursive JSON data",
      value: {
        name: "vendor/model-v2",
        displayName: "Vendor Model",
        family: "vendor.text",
        version: "v2",
        metadata: {
          contextWindow: 128_000,
          enabled: false,
          aliases: ["model-latest", null],
          limits: { requests: 0 },
        },
        extensions: {
          "vendor.routing": {
            regions: ["global"],
          },
        },
      },
    },
    {
      label: "descriptor retaining an unknown JSON field",
      value: {
        name: "future-model",
        metadata: {},
        extensions: {},
        futureOption: {
          enabled: true,
          threshold: 0,
        },
      },
    },
  ])("accepts $label in both runtime contracts", ({ value }) => {
    // Agreement on representative valid data proves the Schema expresses the
    // same public shape as the TypeScript boundary validator.
    expect(isModelDescriptor(value)).toBe(true);
    expect(schemaValidator.validate(value)).toBe(true);
  });

  it.each([
    {
      label: "missing name",
      value: { metadata: {}, extensions: {} },
    },
    {
      label: "non-string name",
      value: { name: 1, metadata: {}, extensions: {} },
    },
    {
      label: "missing metadata",
      value: { name: "model-name", extensions: {} },
    },
    {
      label: "array metadata",
      value: { name: "model-name", metadata: [], extensions: {} },
    },
    {
      label: "non-JSON metadata member",
      value: {
        name: "model-name",
        metadata: { handler: () => undefined },
        extensions: {},
      },
    },
    {
      label: "non-finite metadata number",
      value: {
        name: "model-name",
        metadata: { score: Number.NaN },
        extensions: {},
      },
    },
    {
      label: "missing extensions",
      value: { name: "model-name", metadata: {} },
    },
    {
      label: "array extensions",
      value: { name: "model-name", metadata: {}, extensions: [] },
    },
    {
      label: "null display name",
      value: {
        name: "model-name",
        displayName: null,
        metadata: {},
        extensions: {},
      },
    },
    {
      label: "invalid family",
      value: {
        name: "model-name",
        family: "invalid family",
        metadata: {},
        extensions: {},
      },
    },
    {
      label: "numeric version",
      value: {
        name: "model-name",
        version: 2,
        metadata: {},
        extensions: {},
      },
    },
  ])("rejects $label in both runtime contracts", ({ value }) => {
    // Shared rejection cases keep required fields, optional types, identifier
    // syntax, and recursive JSON boundaries aligned across both validators.
    expect(isModelDescriptor(value)).toBe(false);
    expect(schemaValidator.validate(value)).toBe(false);
  });

  it("does not mutate valid or invalid input", () => {
    const validValue = {
      name: "model-name",
      metadata: { enabled: false, count: 0, values: [] },
      extensions: {},
      futureOption: { preserved: true },
    };
    const invalidValue = {
      name: "model-name",
      family: "invalid family",
      metadata: {},
      extensions: {},
    };
    const originalValidValue = structuredClone(validValue);
    const originalInvalidValue = structuredClone(invalidValue);

    // Ajv mutation options are disabled; accepting unknown members and rejecting
    // invalid values must leave both source object structures and values unchanged.
    expect(schemaValidator.validate(validValue)).toBe(true);
    expect(schemaValidator.validate(invalidValue)).toBe(false);
    expect(validValue).toEqual(originalValidValue);
    expect(invalidValue).toEqual(originalInvalidValue);
  });
});
