// Copyright © 2026 Mcont.

import { beforeAll, describe, expect, it } from "vitest";

import { isServiceAccess } from "../../packages/core-domain/src/service-access.js";
import { loadSchemaById } from "../schema-loader.js";
import { SchemaValidatorAdapter } from "../schema-validator-adapter.js";

/** Stable identifier of the language-neutral ServiceAccess Schema. */
const serviceAccessSchemaId = "https://schemas.evolutos.com/mconet/access/service";

/** Stable identifier used to compare shared recursive JSON definitions. */
const modelDescriptorSchemaId = "https://schemas.evolutos.com/mconet/model/descriptor";

/** ServiceAccess Schema loaded from the committed registry before conformance cases run. */
let serviceAccessSchema: Readonly<Record<string, unknown>>;

/** Existing Schema supplying the independently reviewed shared JSON definitions. */
let modelDescriptorSchema: Readonly<Record<string, unknown>>;

/** Strict compiled validator reused by every serializable ServiceAccess case. */
let schemaValidator: SchemaValidatorAdapter;

beforeAll(async () => {
  // Exercise exact identifier lookup, duplicate detection, deep freezing, and
  // strict Schema compilation against committed registry artifacts.
  serviceAccessSchema = await loadSchemaById(serviceAccessSchemaId);
  modelDescriptorSchema = await loadSchemaById(modelDescriptorSchemaId);
  schemaValidator = new SchemaValidatorAdapter(serviceAccessSchema);
});

describe("ServiceAccess Schema", () => {
  // Keep public shape alignment, authorization exclusion, shared definitions,
  // representative values, and mutation behavior in one conformance boundary.
  it("declares the stable serializable contract and forbids authorization", () => {
    const properties = serviceAccessSchema.properties as Record<string, unknown>;

    // Exact dialect, identity, required containers, known fields, open extension
    // policy, and the false authorization Schema prevent silent contract drift.
    expect(serviceAccessSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(serviceAccessSchema.$id).toBe(serviceAccessSchemaId);
    expect(serviceAccessSchema.required).toEqual(["headers", "query", "extensions"]);
    expect(Object.keys(properties)).toEqual([
      "endpoint",
      "authorization",
      "headers",
      "query",
      "apiVersion",
      "projectId",
      "tenantId",
      "extensions",
    ]);
    expect(properties.authorization).toBe(false);
    expect(serviceAccessSchema.additionalProperties).toBe(true);
    expect(Object.isFrozen(serviceAccessSchema)).toBe(true);
  });

  it("keeps shared recursive JSON definitions aligned", () => {
    const accessDefinitions = serviceAccessSchema.$defs as Record<string, unknown>;
    const descriptorDefinitions = modelDescriptorSchema.$defs as Record<string, unknown>;

    // Compare every shared definition as a whole so scalar, recursive-array, or
    // record rules cannot diverge between otherwise self-contained Schemas.
    for (const definitionName of ["jsonPrimitive", "jsonValue", "jsonRecord"] as const) {
      expect(accessDefinitions[definitionName]).toEqual(descriptorDefinitions[definitionName]);
    }
  });

  it.each([
    {
      label: "minimal access with explicit empty containers",
      value: {
        headers: [],
        query: [],
        extensions: {},
      },
    },
    {
      label: "complete non-sensitive access preserving repeated fields",
      value: {
        endpoint: {
          kind: "absolute",
          value: "HTTPS://[2001:db8::1]:443/v1/models?region=global",
        },
        headers: [
          { name: "x-feature", value: "alpha" },
          { name: "x-feature", value: "beta" },
        ],
        query: [
          { name: "Filter[Name]", value: "café & tea" },
          { name: "Filter[Name]", value: "" },
        ],
        apiVersion: "",
        projectId: "project-a",
        tenantId: "tenant-a",
        extensions: {
          "vendor.routing": {
            region: "global",
            enabled: false,
          },
        },
      },
    },
    {
      label: "access retaining unknown JSON fields",
      value: {
        headers: [],
        query: [],
        extensions: {},
        futureOption: {
          attempts: 0,
          labels: ["primary", null],
        },
      },
    },
  ])("accepts $label in both non-sensitive runtime contracts", ({ value }) => {
    // Agreement proves the ordinary Schema and runtime guard share required,
    // endpoint, ordered-field, optional-string, and extension semantics.
    expect(isServiceAccess(value)).toBe(true);
    expect(schemaValidator.validate(value)).toBe(true);
  });

  it.each([
    {
      label: "missing headers",
      value: { query: [], extensions: {} },
    },
    {
      label: "missing query",
      value: { headers: [], extensions: {} },
    },
    {
      label: "missing extensions",
      value: { headers: [], query: [] },
    },
    {
      label: "relative endpoint",
      value: {
        endpoint: { kind: "relative", value: "/v1/models" },
        headers: [],
        query: [],
        extensions: {},
      },
    },
    {
      label: "non-HTTP endpoint",
      value: {
        endpoint: { kind: "absolute", value: "ftp://models.example.test/v1" },
        headers: [],
        query: [],
        extensions: {},
      },
    },
    {
      label: "endpoint containing user information",
      value: {
        endpoint: { kind: "absolute", value: "https://user:secret@models.example.test/v1" },
        headers: [],
        query: [],
        extensions: {},
      },
    },
    {
      label: "endpoint containing a fragment",
      value: {
        endpoint: { kind: "absolute", value: "https://models.example.test/v1#fragment" },
        headers: [],
        query: [],
        extensions: {},
      },
    },
    {
      label: "non-normalized header name",
      value: {
        headers: [{ name: "X-Feature", value: "enabled" }],
        query: [],
        extensions: {},
      },
    },
    {
      label: "header value containing a line break",
      value: {
        headers: [{ name: "x-feature", value: "first\nsecond" }],
        query: [],
        extensions: {},
      },
    },
    {
      label: "incomplete query occurrence",
      value: {
        headers: [],
        query: [{ name: "tag" }],
        extensions: {},
      },
    },
    {
      label: "numeric project identifier",
      value: {
        headers: [],
        query: [],
        projectId: 1,
        extensions: {},
      },
    },
    {
      label: "array extensions",
      value: {
        headers: [],
        query: [],
        extensions: [],
      },
    },
    {
      label: "non-finite extension number",
      value: {
        headers: [],
        query: [],
        extensions: { score: Number.NaN },
      },
    },
  ])("rejects $label in both non-sensitive runtime contracts", ({ value }) => {
    // Shared rejection cases align required members, endpoint policy, field
    // safety, optional typing, and recursive JSON data across both validators.
    expect(isServiceAccess(value)).toBe(false);
    expect(schemaValidator.validate(value)).toBe(false);
  });

  it("rejects Authorization from ordinary Schema serialization", () => {
    const accessWithAuthorization = {
      authorization: {
        kind: "company.signature",
        credentialReference: "secure-provider-owned-reference",
      },
      headers: [],
      query: [],
      extensions: {},
    };

    // Runtime configuration may carry an open Authorization object, but the
    // ordinary language-neutral Schema deliberately excludes the entire field.
    expect(isServiceAccess(accessWithAuthorization)).toBe(true);
    expect(schemaValidator.validate(accessWithAuthorization)).toBe(false);
  });

  it("does not mutate valid or invalid input", () => {
    const validValue = {
      endpoint: { kind: "absolute", value: "https://models.example.test/v1" },
      headers: [{ name: "x-feature", value: "enabled" }],
      query: [{ name: "tag", value: "alpha" }],
      extensions: {},
      futureOption: { preserved: true },
    };
    const invalidValue = {
      endpoint: { kind: "absolute", value: "ftp://models.example.test/v1" },
      headers: [],
      query: [],
      extensions: {},
    };
    const originalValidValue = structuredClone(validValue);
    const originalInvalidValue = structuredClone(invalidValue);

    // Ajv mutation options are disabled; validation must preserve known and
    // unknown fields for both accepted and rejected values.
    expect(schemaValidator.validate(validValue)).toBe(true);
    expect(schemaValidator.validate(invalidValue)).toBe(false);
    expect(validValue).toEqual(originalValidValue);
    expect(invalidValue).toEqual(originalInvalidValue);
  });
});
