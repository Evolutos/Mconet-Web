// Copyright © 2026 Mcont.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadSchemaById } from "../schema-loader.js";
import { SchemaValidatorAdapter } from "../schema-validator-adapter.js";

/** Stable identifier used by the isolated validator test Schema. */
const schemaId = "https://schemas.evolutos.com/mconet/testing/validator-example";

/** Temporary Schema registry recreated for every adapter test. */
let schemaDirectory: string;

/** Adapter compiled from the Schema loaded during test setup. */
let validator: SchemaValidatorAdapter;

beforeEach(async () => {
  // Build one temporary draft 2020-12 registry so the test exercises the loader
  // and adapter boundary without committing a business Schema ahead of its step.
  schemaDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "mconet-schema-validator-"));
  const schema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: schemaId,
    type: "object",
    properties: {
      endpoint: { type: "string", format: "uri" },
      attempts: { type: "integer", minimum: 0 },
      label: { type: "string", default: "generated" },
      tags: {
        type: "array",
        prefixItems: [{ type: "string", minLength: 1 }],
        items: false,
        minItems: 1,
      },
    },
    required: ["endpoint", "attempts", "tags"],
    additionalProperties: false,
  };

  await fs.writeFile(
    path.join(schemaDirectory, "validator-example.schema.json"),
    JSON.stringify(schema),
    "utf8",
  );
  const loadedSchema = await loadSchemaById(schemaId, schemaDirectory);
  validator = new SchemaValidatorAdapter(loadedSchema);
});

afterEach(async () => {
  // Remove only the exact temporary registry created for the matching test.
  await fs.rm(schemaDirectory, { force: true, recursive: true });
});

describe("SchemaValidatorAdapter", () => {
  it("accepts a valid Fixture using draft 2020 and reviewed formats", () => {
    const fixture = {
      endpoint: "https://api.example.com/models",
      attempts: 0,
      tags: ["primary"],
    };

    expect(validator.validate(fixture)).toBe(true);
  });

  it("rejects an invalid Fixture with a stable boolean result", () => {
    const fixture = {
      endpoint: "not a URI",
      attempts: -1,
      tags: [0, "unexpected"],
      extra: true,
    };

    expect(validator.validate(fixture)).toBe(false);
  });

  it("does not coerce or modify invalid Fixture data", () => {
    const fixture = {
      endpoint: "https://api.example.com/models",
      attempts: "1",
      tags: ["primary"],
      extra: true,
    };
    const originalFixture = structuredClone(fixture);

    expect(validator.validate(fixture)).toBe(false);
    expect(fixture).toEqual(originalFixture);
  });

  it("rejects an asynchronous Schema before Fixture validation", () => {
    const asyncSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "urn:mconet:async-schema",
      $async: true,
      type: "object",
    } as const;

    expect(() => new SchemaValidatorAdapter(asyncSchema)).toThrow(
      "must not enable asynchronous validation",
    );
  });

  it("rejects a Schema from a different JSON Schema dialect", () => {
    const olderDialectSchema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "urn:mconet:older-dialect",
      type: "object",
    } as const;

    // Dialect selection is explicit because draft 2020 keywords are not
    // backwards compatible with earlier JSON Schema drafts.
    expect(() => new SchemaValidatorAdapter(olderDialectSchema)).toThrow("must declare dialect");
  });

  it("rejects formats outside the reviewed format set", () => {
    const unsupportedFormatSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "urn:mconet:unsupported-format",
      type: "string",
      format: "email",
    } as const;

    // Strict compilation must not silently treat an unregistered format as an
    // annotation when cross-language conformance expects validation.
    expect(() => new SchemaValidatorAdapter(unsupportedFormatSchema)).toThrow(
      "Unable to compile Schema",
    );
  });
});
