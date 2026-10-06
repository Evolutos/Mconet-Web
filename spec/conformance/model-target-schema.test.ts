// Copyright © 2026 Mcont.

import { beforeAll, describe, expect, it } from "vitest";

import { isModelTarget } from "../../packages/core-domain/src/model-target.js";
import { loadSchemaById } from "../schema-loader.js";
import { SchemaValidatorAdapter } from "../schema-validator-adapter.js";

/** Stable identifier of the language-neutral ModelTarget Schema. */
const modelTargetSchemaId = "https://schemas.evolutos.com/mconet/model/target";

/** Stable identifier of the separately committed ModelDescriptor Schema. */
const modelDescriptorSchemaId = "https://schemas.evolutos.com/mconet/model/descriptor";

/** Schema document loaded from the committed registry before conformance cases run. */
let modelTargetSchema: Readonly<Record<string, unknown>>;

/** Independent descriptor Schema used to detect embedded-contract drift. */
let modelDescriptorSchema: Readonly<Record<string, unknown>>;

/** Strict compiled validator reused by every ModelTarget conformance case. */
let schemaValidator: SchemaValidatorAdapter;

beforeAll(async () => {
  // Resolve through the production loader so registry discovery, identity
  // uniqueness, deep freezing, and strict Schema compilation are all exercised.
  modelTargetSchema = await loadSchemaById(modelTargetSchemaId);
  modelDescriptorSchema = await loadSchemaById(modelDescriptorSchemaId);
  schemaValidator = new SchemaValidatorAdapter(modelTargetSchema);
});

describe("ModelTarget Schema", () => {
  // Keep identity, structural alignment, representative data, and mutation
  // behavior together as the complete conformance boundary for this Schema.
  it("declares the stable identity and complete top-level contract", () => {
    // Exact dialect, identifier, required set, known properties, and open-field
    // policy make accidental target-contract drift visible in one assertion set.
    expect(modelTargetSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(modelTargetSchema.$id).toBe(modelTargetSchemaId);
    expect(modelTargetSchema.required).toEqual(["serviceId", "protocolId", "model", "extensions"]);
    expect(Object.keys(modelTargetSchema.properties as Record<string, unknown>)).toEqual([
      "serviceId",
      "protocolId",
      "model",
      "deploymentId",
      "extensions",
    ]);
    expect(modelTargetSchema.additionalProperties).toBe(true);
    expect(Object.isFrozen(modelTargetSchema)).toBe(true);
  });

  it("keeps the embedded model contract aligned with ModelDescriptor", () => {
    const targetDefinitions = modelTargetSchema.$defs as Record<string, unknown>;
    const descriptorDefinitions = modelDescriptorSchema.$defs as Record<string, unknown>;
    const embeddedModelDescriptor = targetDefinitions.modelDescriptor as Record<string, unknown>;

    // Compare every contract-bearing root keyword rather than a hand-picked
    // sample so a descriptor property or field rule cannot drift silently.
    expect(embeddedModelDescriptor.type).toEqual(modelDescriptorSchema.type);
    expect(embeddedModelDescriptor.properties).toEqual(modelDescriptorSchema.properties);
    expect(embeddedModelDescriptor.required).toEqual(modelDescriptorSchema.required);
    expect(embeddedModelDescriptor.additionalProperties).toEqual(
      modelDescriptorSchema.additionalProperties,
    );

    // Both self-contained Schemas must use identical shared definitions for all
    // references reachable from the embedded descriptor contract.
    for (const definitionName of [
      "openIdentifier",
      "jsonPrimitive",
      "jsonValue",
      "jsonRecord",
    ] as const) {
      expect(targetDefinitions[definitionName]).toEqual(descriptorDefinitions[definitionName]);
    }
    expect(Object.isFrozen(embeddedModelDescriptor)).toBe(true);
  });

  it.each([
    {
      label: "minimal target with distinct identities",
      value: {
        serviceId: "vendor.service",
        protocolId: "vendor.protocol",
        model: {
          name: "",
          metadata: {},
          extensions: {},
        },
        extensions: {},
      },
    },
    {
      label: "complete target with an empty opaque deployment identifier",
      value: {
        serviceId: "gateway.service",
        protocolId: "openai.chat.completions",
        model: {
          name: "vendor/model-v2",
          displayName: "Vendor Model",
          family: "vendor.text",
          version: "v2",
          metadata: {
            contextWindow: 128_000,
            enabled: false,
            aliases: ["model-latest", null],
          },
          extensions: {
            "vendor.model": {
              capability: "text",
            },
          },
        },
        deploymentId: "",
        extensions: {
          "vendor.routing": {
            regions: ["global"],
            weight: 0,
          },
        },
      },
    },
    {
      label: "target and model retaining unknown JSON fields",
      value: {
        serviceId: "private.service",
        protocolId: "private.protocol",
        model: {
          name: "private-model",
          metadata: {},
          extensions: {},
          deploymentRegion: "internal-zone",
        },
        extensions: {},
        futureOption: {
          enabled: true,
          threshold: 0,
        },
      },
    },
  ])("accepts $label in both runtime contracts", ({ value }) => {
    // Shared valid cases prove service, protocol, model, deployment, extensions,
    // and structural openness agree between TypeScript and JSON Schema boundaries.
    expect(isModelTarget(value)).toBe(true);
    expect(schemaValidator.validate(value)).toBe(true);
  });

  it.each([
    {
      label: "missing service identifier",
      value: {
        protocolId: "vendor.protocol",
        model: { name: "model-name", metadata: {}, extensions: {} },
        extensions: {},
      },
    },
    {
      label: "missing protocol identifier",
      value: {
        serviceId: "vendor.service",
        model: { name: "model-name", metadata: {}, extensions: {} },
        extensions: {},
      },
    },
    {
      label: "missing model",
      value: {
        serviceId: "vendor.service",
        protocolId: "vendor.protocol",
        extensions: {},
      },
    },
    {
      label: "missing target extensions",
      value: {
        serviceId: "vendor.service",
        protocolId: "vendor.protocol",
        model: { name: "model-name", metadata: {}, extensions: {} },
      },
    },
    {
      label: "empty service identifier",
      value: {
        serviceId: "",
        protocolId: "vendor.protocol",
        model: { name: "model-name", metadata: {}, extensions: {} },
        extensions: {},
      },
    },
    {
      label: "segmented protocol identifier with an empty segment",
      value: {
        serviceId: "vendor.service",
        protocolId: "vendor..protocol",
        model: { name: "model-name", metadata: {}, extensions: {} },
        extensions: {},
      },
    },
    {
      label: "model without a name",
      value: {
        serviceId: "vendor.service",
        protocolId: "vendor.protocol",
        model: { metadata: {}, extensions: {} },
        extensions: {},
      },
    },
    {
      label: "model with an invalid family",
      value: {
        serviceId: "vendor.service",
        protocolId: "vendor.protocol",
        model: {
          name: "model-name",
          family: "invalid family",
          metadata: {},
          extensions: {},
        },
        extensions: {},
      },
    },
    {
      label: "model with array metadata",
      value: {
        serviceId: "vendor.service",
        protocolId: "vendor.protocol",
        model: { name: "model-name", metadata: [], extensions: {} },
        extensions: {},
      },
    },
    {
      label: "numeric deployment identifier",
      value: {
        serviceId: "vendor.service",
        protocolId: "vendor.protocol",
        model: { name: "model-name", metadata: {}, extensions: {} },
        deploymentId: 1,
        extensions: {},
      },
    },
    {
      label: "array target extensions",
      value: {
        serviceId: "vendor.service",
        protocolId: "vendor.protocol",
        model: { name: "model-name", metadata: {}, extensions: {} },
        extensions: [],
      },
    },
    {
      label: "non-finite target extension number",
      value: {
        serviceId: "vendor.service",
        protocolId: "vendor.protocol",
        model: { name: "model-name", metadata: {}, extensions: {} },
        extensions: { score: Number.NaN },
      },
    },
  ])("rejects $label in both runtime contracts", ({ value }) => {
    // Shared invalid cases align required fields, identifier syntax, nested model
    // validation, deployment typing, and recursive JSON extension boundaries.
    expect(isModelTarget(value)).toBe(false);
    expect(schemaValidator.validate(value)).toBe(false);
  });

  it("does not mutate valid or invalid input", () => {
    const validValue = {
      serviceId: "vendor.service",
      protocolId: "vendor.protocol",
      model: {
        name: "model-name",
        metadata: { enabled: false, count: 0, values: [] },
        extensions: {},
      },
      deploymentId: "deployment-blue",
      extensions: {},
      futureOption: { preserved: true },
    };
    const invalidValue = {
      serviceId: "invalid service",
      protocolId: "vendor.protocol",
      model: { name: "model-name", metadata: {}, extensions: {} },
      extensions: {},
    };
    const originalValidValue = structuredClone(validValue);
    const originalInvalidValue = structuredClone(invalidValue);

    // Ajv mutation options are disabled; acceptance and rejection must preserve
    // all source values, including unknown fields and explicit empty containers.
    expect(schemaValidator.validate(validValue)).toBe(true);
    expect(schemaValidator.validate(invalidValue)).toBe(false);
    expect(validValue).toEqual(originalValidValue);
    expect(invalidValue).toEqual(originalInvalidValue);
  });
});
