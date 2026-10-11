// Copyright © 2026 Mcont.

import { beforeAll, describe, expect, it } from "vitest";

import type { JsonPayload } from "../../packages/codec-json/src/json-payload.js";
import { isOpenIdentifier } from "../../packages/core-domain/src/open-identifier.js";
import { loadSchemaById } from "../schema-loader.js";
import { SchemaValidatorAdapter } from "../schema-validator-adapter.js";

/** Stable identifier of the self-contained JsonPayload Schema. */
const jsonPayloadSchemaId = "https://schemas.evolutos.com/mconet/json/payload";

/**
 * Existing Schema whose portable identifier and JSON grammar this payload
 * Schema must copy verbatim.
 *
 * Equality against this document prevents the payload Schema from inventing a
 * second open-identifier or JSON-value dialect.
 */
const modelDescriptorSchemaId = "https://schemas.evolutos.com/mconet/model/descriptor";

/**
 * Inclusive open-identifier length shared with the domain validator.
 *
 * The Schema reuses the reviewed `openIdentifier` definition, whose `maxLength`
 * is this many Unicode code points. The named limit keeps boundary examples
 * from repeating an unexplained literal.
 */
const maximumOpenIdentifierCodePoints = 128;

/** Portable definitions that must stay identical across self-contained Schemas. */
const sharedDefinitionNames = [
  "openIdentifier",
  "jsonPrimitive",
  "jsonValue",
  "jsonRecord",
] as const;

/** JsonPayload Schema loaded from the committed registry before conformance cases run. */
let jsonPayloadSchema: Readonly<Record<string, unknown>>;

/** Existing Schema supplying the independently reviewed shared JSON definitions. */
let modelDescriptorSchema: Readonly<Record<string, unknown>>;

/** Strict compiled validator reused by every JsonPayload conformance case. */
let schemaValidator: SchemaValidatorAdapter;

beforeAll(async () => {
  // Registry loading makes exact identifiers, duplicate detection, deep
  // freezing, and strict draft compilation part of every assertion below.
  jsonPayloadSchema = await loadSchemaById(jsonPayloadSchemaId);
  modelDescriptorSchema = await loadSchemaById(modelDescriptorSchemaId);
  schemaValidator = new SchemaValidatorAdapter(jsonPayloadSchema);
});

describe("JsonPayload Schema", () => {
  // Envelope identity, member types, shared grammar, representative values, and
  // immutability form one acceptance contract for the erased JSON payload.
  it("declares the stable identity and exact payload envelope", () => {
    const properties = jsonPayloadSchema.properties as Record<string, unknown>;
    const typeId = properties.typeId as Record<string, unknown>;
    const schemaId = properties.schemaId as Record<string, unknown>;
    const value = properties.value as Record<string, unknown>;

    // Exact membership keeps media types, codecs, transport objects, and
    // authorization facts from becoming required payload fields.
    expect(jsonPayloadSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(jsonPayloadSchema.$id).toBe(jsonPayloadSchemaId);
    expect(Object.keys(properties)).toEqual(["typeId", "schemaId", "value"]);
    expect(jsonPayloadSchema.required).toEqual(["typeId", "value"]);
    expect(jsonPayloadSchema.additionalProperties).toBe(true);
    expect(Object.isFrozen(jsonPayloadSchema)).toBe(true);

    // typeId and value borrow the shared definitions. schemaId stays a plain
    // string so Schema URIs and empty labels are not rewritten as identifiers.
    expect(typeId.$ref).toBe("#/$defs/openIdentifier");
    expect(value.$ref).toBe("#/$defs/jsonValue");
    expect(schemaId.type).toBe("string");
    expect(schemaId.$ref).toBeUndefined();
    expect(schemaId.format).toBeUndefined();
    expect(schemaId.pattern).toBeUndefined();
    expect(schemaId.minLength).toBeUndefined();
    expect(schemaId.enum).toBeUndefined();
  });

  it("keeps identifier and recursive JSON definitions aligned", () => {
    const payloadDefinitions = jsonPayloadSchema.$defs as Record<string, unknown>;
    const descriptorDefinitions = modelDescriptorSchema.$defs as Record<string, unknown>;

    // Whole-definition equality prevents a local pattern, length, or recursive
    // branch from drifting away from the reviewed portable grammar.
    for (const definitionName of sharedDefinitionNames) {
      expect(payloadDefinitions[definitionName]).toEqual(descriptorDefinitions[definitionName]);
    }
  });

  // Accepted documents cover every JSON value category, both states of the
  // optional schema identity, and strings that are not open identifiers.
  it.each([
    {
      label: "null value without a schema identity",
      value: { typeId: "json.null", value: null },
    },
    {
      label: "boolean false, which remains distinct from an omitted member",
      value: { typeId: "json.boolean", value: false },
    },
    {
      label: "numeric zero, which remains distinct from an omitted member",
      value: { typeId: "json.number", value: 0 },
    },
    {
      label: "empty string value",
      value: { typeId: "json.string", value: "" },
    },
    {
      label: "string value containing a newline and a non-BMP character",
      value: { typeId: "json.string", value: "line\n😀" },
    },
    {
      label: "ordered mixed array",
      value: { typeId: "json.array", value: ["hello", 42, false, null] },
    },
    {
      label: "nested object with the schema identity frozen by the type contract",
      value: {
        typeId: "json.object",
        schemaId: "schema://json.contract/object/1",
        value: { nested: { enabled: true }, items: [1, 2, 3] },
      },
    },
    {
      label: "present empty schema identity, which is not the same as omission",
      value: { typeId: "json.object", schemaId: "", value: {} },
    },
    {
      label: "schema identity that is not an open identifier",
      value: { typeId: "json.string", schemaId: "not an identifier", value: "hello" },
    },
    {
      label: "empty array and empty object values",
      value: { typeId: "json.collection", value: { items: [], metadata: {} } },
    },
  ] as const satisfies readonly { readonly label: string; readonly value: JsonPayload }[])(
    "accepts $label",
    ({ value }) => {
      // Every accepted document is already constrained by `satisfies JsonPayload`,
      // so Schema acceptance cannot grow a field the type contract rejects.
      expect(schemaValidator.validate(value)).toBe(true);
    },
  );

  it("retains an unknown member without treating it as payload control data", () => {
    const payload = {
      typeId: "json.object",
      value: { enabled: false },
      futureOption: { preserved: true },
    };

    // Unknown retention is a Schema rule. The extra member is intentionally
    // absent from JsonPayload, so this case is not assigned to that type.
    expect(schemaValidator.validate(payload)).toBe(true);
    expect(payload.futureOption).toEqual({ preserved: true });
  });

  // Identifier acceptance must match the domain validator, including the
  // Unicode code-point length boundary the shared definition declares.
  it.each([
    "json.null",
    "conversation",
    "task.input.conversation",
    "vendor.custom-kind_v2",
    "扩展.文本",
    "a".repeat(maximumOpenIdentifierCodePoints),
    "😀".repeat(maximumOpenIdentifierCodePoints),
  ])("accepts typeId %j when the domain identifier contract accepts it", (typeId) => {
    expectTypeIdAgreement(typeId, true);
  });

  // Identifier rejection must match the domain validator for blank input,
  // broken namespace segments, non-characters, and the length boundary.
  it.each([
    "",
    " ",
    "\t",
    " message.user",
    "message.user ",
    "message. user",
    ".message",
    "message.",
    "message..user",
    ".",
    "message\u0000user",
    "message\u200Buser",
    "a".repeat(maximumOpenIdentifierCodePoints + 1),
    "😀".repeat(maximumOpenIdentifierCodePoints + 1),
  ])("rejects typeId %j when the domain identifier contract rejects it", (typeId) => {
    expectTypeIdAgreement(typeId, false);
  });

  // Rejections cover a non-object document, missing required members, a schema
  // identity that is present but not a string, and non-JSON values at every
  // depth the shared recursive grammar accepts.
  it.each([
    { label: "null document", value: null },
    { label: "array document", value: [] },
    { label: "string document", value: "json.null" },
    { label: "missing typeId", value: { value: null } },
    { label: "missing value", value: { typeId: "json.null" } },
    { label: "numeric typeId", value: { typeId: 1, value: null } },
    { label: "null schema identity", value: { typeId: "json.null", schemaId: null, value: null } },
    { label: "numeric schema identity", value: { typeId: "json.null", schemaId: 1, value: null } },
    {
      label: "object schema identity",
      value: { typeId: "json.null", schemaId: { id: "json.null" }, value: null },
    },
    { label: "non-finite value", value: { typeId: "json.number", value: Number.NaN } },
    { label: "infinite value", value: { typeId: "json.number", value: Number.POSITIVE_INFINITY } },
    {
      label: "non-finite number nested in an array",
      value: { typeId: "json.array", value: [Number.NaN] },
    },
    {
      label: "non-finite number nested in an object",
      value: { typeId: "json.object", value: { score: Number.NaN } },
    },
    { label: "bigint value", value: { typeId: "json.bigint", value: 1n } },
    { label: "function value", value: { typeId: "json.function", value: () => undefined } },
  ])("rejects $label", ({ value }) => {
    // These documents violate the envelope, the optional-string rule, or the
    // JSON value grammar. They are not assigned to JsonPayload.
    expect(schemaValidator.validate(value)).toBe(false);
  });

  it("does not mutate valid or invalid input", () => {
    const validValue = {
      typeId: "json.object",
      schemaId: "schema://json.contract/object/1",
      value: { enabled: false, count: 0, values: [] },
      futureOption: { preserved: true },
    };
    const invalidValue = {
      typeId: "invalid type",
      schemaId: null,
      value: Number.NaN,
    };
    const originalValidValue = structuredClone(validValue);
    const originalInvalidValue = structuredClone(invalidValue);

    // Ajv mutation options are disabled. Accepting an unknown member and
    // rejecting an invalid document must leave both objects unchanged.
    expect(schemaValidator.validate(validValue)).toBe(true);
    expect(schemaValidator.validate(invalidValue)).toBe(false);
    expect(validValue).toEqual(originalValidValue);
    expect(invalidValue).toEqual(originalInvalidValue);
  });
});

/**
 * Checks one type identifier against both the domain validator and the Schema.
 *
 * `OpenIdentifier` is a string alias, so Schema alignment has to follow
 * `isOpenIdentifier` rather than the TypeScript alias alone. The value is null
 * so only the identifier decision can change the result.
 *
 * @param typeId Candidate semantic identity.
 * @param accepted Whether both contracts must accept the candidate.
 */
function expectTypeIdAgreement(typeId: string, accepted: boolean): void {
  expect(isOpenIdentifier(typeId)).toBe(accepted);
  expect(schemaValidator.validate({ typeId, value: null })).toBe(accepted);
}
