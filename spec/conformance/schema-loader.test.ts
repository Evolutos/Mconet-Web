// Copyright © 2026 Mcont.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadSchemaById } from "../schema-loader.js";

/** Temporary Schema registry recreated for every loader test. */
let schemaDirectory: string;

beforeEach(async () => {
  // Use an isolated real directory so discovery behavior matches conformance
  // execution without committing a test-only Schema into the shared registry.
  schemaDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "mconet-schema-loader-"));
});

afterEach(async () => {
  // Remove only the unique directory created by the matching setup callback.
  await fs.rm(schemaDirectory, { force: true, recursive: true });
});

describe("loadSchemaById", () => {
  it("loads one nested Schema by its exact stable identifier", async () => {
    const schemaId = "https://schemas.evolutos.com/mconet/testing/example";
    const nestedDirectory = path.join(schemaDirectory, "nested");
    const schema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: schemaId,
      type: "object",
      properties: {
        enabled: { type: "boolean" },
      },
      required: ["enabled"],
    };

    // Deliberately use a filename unrelated to the identifier to prove lookup is
    // based on `$id` rather than a derived or caller-controlled path.
    await fs.mkdir(nestedDirectory);
    await fs.writeFile(
      path.join(nestedDirectory, "example.schema.json"),
      JSON.stringify(schema),
      "utf8",
    );

    const loaded = await loadSchemaById(schemaId, schemaDirectory);

    expect(loaded).toEqual(schema);
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded.properties)).toBe(true);
    expect(Object.isFrozen(loaded.required)).toBe(true);
  });

  it("rejects an identifier that would require implicit normalization", async () => {
    // Exact lookup must not trim caller input because a normalized identifier
    // could resolve a different cross-language Schema contract.
    await expect(loadSchemaById(" schema-id ", schemaDirectory)).rejects.toThrow(
      "contain no surrounding whitespace",
    );
  });

  it("reports an absent identifier without deriving a filename fallback", async () => {
    // The empty registry proves a missing identifier is explicit and does not
    // trigger network access, version fallback, or path inference.
    await expect(loadSchemaById("urn:mconet:missing", schemaDirectory)).rejects.toThrow(
      "was not found",
    );
  });

  it("rejects duplicate stable identifiers anywhere in the registry", async () => {
    const schemaId = "urn:mconet:duplicate";
    const schemaSource = JSON.stringify({ $id: schemaId, type: "null" });

    // Two distinct files with the same `$id` must fail instead of allowing
    // filesystem enumeration order to choose the active contract.
    await fs.writeFile(path.join(schemaDirectory, "alpha.schema.json"), schemaSource, "utf8");
    await fs.writeFile(path.join(schemaDirectory, "beta.schema.json"), schemaSource, "utf8");

    // Request a different identifier to prove registry integrity does not depend
    // on which Schema the caller happens to load first.
    await expect(loadSchemaById("urn:mconet:other", schemaDirectory)).rejects.toThrow(
      "Duplicate Schema identifier",
    );
  });
});
