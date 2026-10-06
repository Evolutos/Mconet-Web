// Copyright © 2026 Mcont.

import { beforeAll, describe, expect, it } from "vitest";

import {
  validateArtifactCatalogIds,
  type ArtifactCatalog,
} from "../../packages/core-domain/src/artifact-catalog.js";
import { isArtifact, type Artifact } from "../../packages/core-domain/src/artifact.js";
import type { InlineArtifactSource } from "../../packages/core-domain/src/inline-artifact-source.js";
import type { UriArtifactSource } from "../../packages/core-domain/src/uri-artifact-source.js";
import { loadSchemaById } from "../schema-loader.js";
import { SchemaValidatorAdapter } from "../schema-validator-adapter.js";

/** Stable identifier of the self-contained ArtifactCatalog Schema. */
const artifactCatalogSchemaId = "https://schemas.evolutos.com/mconet/artifact/catalog";

/** Stable identifier of the separately committed Artifact Schema. */
const artifactSchemaId = "https://schemas.evolutos.com/mconet/artifact";

/** ArtifactCatalog Schema loaded from the committed registry. */
let artifactCatalogSchema: Readonly<Record<string, unknown>>;

/** Independent Artifact Schema used to detect embedded-contract drift. */
let artifactSchema: Readonly<Record<string, unknown>>;

/** Strict compiled validator reused by every Catalog conformance case. */
let schemaValidator: SchemaValidatorAdapter;

beforeAll(async () => {
  // Resolve both documents through the production loader so registry identity,
  // deep freezing, self-containment, and strict compilation are exercised.
  artifactCatalogSchema = await loadSchemaById(artifactCatalogSchemaId);
  artifactSchema = await loadSchemaById(artifactSchemaId);
  schemaValidator = new SchemaValidatorAdapter(artifactCatalogSchema);
});

describe("ArtifactCatalog Schema", () => {
  // Keep root structure, embedded-contract alignment, semantic uniqueness, open
  // fields, and mutation checks together for this single Schema document.
  it("declares the stable identity and single required collection", () => {
    // Exact dialect, identifier, required set, property set, and openness expose
    // accidental Catalog envelope drift independently from Fixture values.
    expect(artifactCatalogSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(artifactCatalogSchema.$id).toBe(artifactCatalogSchemaId);
    expect(artifactCatalogSchema.required).toEqual(["artifacts"]);
    expect(Object.keys(artifactCatalogSchema.properties as Record<string, unknown>)).toEqual([
      "artifacts",
    ]);
    expect(artifactCatalogSchema.additionalProperties).toBe(true);
    expect(Object.isFrozen(artifactCatalogSchema)).toBe(true);
  });

  it("keeps the embedded Artifact contract aligned with its independent Schema", () => {
    const catalogDefinitions = artifactCatalogSchema.$defs as Record<string, unknown>;
    const artifactDefinitions = artifactSchema.$defs as Record<string, unknown>;
    const embeddedArtifact = catalogDefinitions.artifact as Record<string, unknown>;

    // Compare every contract-bearing root keyword so Catalog items cannot add,
    // remove, or weaken an Artifact field silently.
    expect(embeddedArtifact.type).toEqual(artifactSchema.type);
    expect(embeddedArtifact.properties).toEqual(artifactSchema.properties);
    expect(embeddedArtifact.required).toEqual(artifactSchema.required);
    expect(embeddedArtifact.additionalProperties).toEqual(artifactSchema.additionalProperties);

    // Every definition reachable from Artifact must remain byte-for-byte equal in
    // parsed JSON form, including source branches, media syntax, URI, and JSON.
    for (const definitionName of Object.keys(artifactDefinitions)) {
      expect(catalogDefinitions[definitionName]).toEqual(artifactDefinitions[definitionName]);
    }
    expect(Object.isFrozen(embeddedArtifact)).toBe(true);
  });

  it("accepts an empty Catalog as the only empty representation", () => {
    const catalog: ArtifactCatalog = { artifacts: [] };

    // Schema and semantic uniqueness validation both accept an explicit empty
    // array without null, omission, or sentinel Artifact values.
    expect(schemaValidator.validate(catalog)).toBe(true);
    expect(validateArtifactCatalogIds(catalog)).toEqual({
      value: catalog,
      diagnostics: [],
    });
  });

  it("accepts an ordered Catalog with inline and URI Artifacts", () => {
    const inline = createCatalogSchemaArtifact("artifact-inline");
    const uri = createCatalogSchemaArtifact("artifact-uri", {
      kind: "artifact.source.uri",
      uri: {
        kind: "absolute",
        value: "https://assets.example.invalid/image.png",
      },
    });
    const catalog: ArtifactCatalog = { artifacts: [inline, uri] };

    // Validate every item through the runtime trust boundary before asserting the
    // complete self-contained Schema and Catalog uniqueness result.
    for (const artifact of catalog.artifacts) {
      expect(isArtifact(artifact)).toBe(true);
    }
    expect(schemaValidator.validate(catalog)).toBe(true);
    expect(validateArtifactCatalogIds(catalog).value).toBe(catalog);

    // Ordered collection identity remains untouched by all validation layers.
    expect(catalog.artifacts[0]).toBe(inline);
    expect(catalog.artifacts[1]).toBe(uri);
  });

  it.each([
    {
      label: "missing collection",
      value: {},
    },
    {
      label: "null collection",
      value: { artifacts: null },
    },
    {
      label: "single Artifact instead of a collection",
      value: { artifacts: createCatalogSchemaArtifact("artifact-single") },
    },
    {
      label: "null collection item",
      value: { artifacts: [null] },
    },
    {
      label: "Artifact without metadata",
      value: {
        artifacts: [
          {
            id: "artifact-invalid",
            kind: { id: "artifact.unknown", extensions: {} },
            source: { kind: "provider.source.fixture" },
            extensions: {},
          },
        ],
      },
    },
    {
      label: "Artifact with invalid media type",
      value: {
        artifacts: [
          {
            ...createCatalogSchemaArtifact("artifact-invalid-media"),
            mediaType: "invalid",
          },
        ],
      },
    },
  ])("rejects $label structurally", ({ value }) => {
    // Each value contains one local Catalog or embedded Artifact fault, proving
    // the self-contained item contract compiles and rejects independently.
    expect(schemaValidator.validate(value)).toBe(false);
  });

  it("leaves Catalog-wide ID uniqueness to the runtime validator", () => {
    const catalog: ArtifactCatalog = {
      artifacts: [
        createCatalogSchemaArtifact("artifact-duplicate"),
        createCatalogSchemaArtifact("artifact-duplicate"),
      ],
    };

    // Standard JSON Schema validates individual items but cannot require one
    // selected property to be unique across arbitrary object items.
    expect(schemaValidator.validate(catalog)).toBe(true);
    expect(validateArtifactCatalogIds(catalog).diagnostics[0]).toMatchObject({
      code: "duplicate_artifact_id",
      path: "artifacts[1].id",
    });
  });

  it("preserves unknown Catalog and embedded Artifact fields", () => {
    const artifact = {
      ...createCatalogSchemaArtifact("artifact-future"),
      futureArtifactField: { retained: true },
    };
    const catalog = {
      artifacts: [artifact],
      futureCatalogField: {
        enabled: false,
        priority: 0,
      },
    };

    // Both open layers retain unrecognized data without changing the required
    // collection or interpreting future semantics.
    expect(isArtifact(artifact)).toBe(true);
    expect(schemaValidator.validate(catalog)).toBe(true);
    expect(validateArtifactCatalogIds(catalog).value).toBe(catalog);
  });

  it("does not mutate valid or invalid Catalog data", () => {
    const validCatalog: ArtifactCatalog = {
      artifacts: [createCatalogSchemaArtifact("artifact-valid")],
    };
    const invalidCatalog = {
      artifacts: [
        {
          ...createCatalogSchemaArtifact("artifact-invalid"),
          source: { kind: "artifact.source.uri" },
        },
      ],
    };
    const originalValidCatalog = structuredClone(validCatalog);
    const originalInvalidCatalog = structuredClone(invalidCatalog);

    // Adapter mutation features are disabled, preserving order, bytes, unknown
    // fields, and malformed source data for subsequent diagnostics.
    expect(schemaValidator.validate(validCatalog)).toBe(true);
    expect(schemaValidator.validate(invalidCatalog)).toBe(false);
    expect(validCatalog).toEqual(originalValidCatalog);
    expect(invalidCatalog).toEqual(originalInvalidCatalog);
  });
});

/** Creates one complete Artifact for self-contained Catalog Schema cases. */
function createCatalogSchemaArtifact(
  id: string,
  source: InlineArtifactSource | UriArtifactSource = {
    kind: "artifact.source.inline",
    bytes: new Uint8Array([0, 1, 2, 255]),
  },
): Artifact {
  // Allocate independent nested records on every call so item mutation and ID
  // duplication cases cannot leak state or depend on reused object identity.
  return {
    id,
    kind: {
      id: "artifact.image",
      semantic: "image",
      extensions: {},
    },
    mediaType: "image/png",
    source,
    descriptor: {
      kind: "artifact.descriptor.image",
    },
    metadata: {
      labels: ["catalog", "示例"],
      featured: false,
    },
    extensions: {
      "provider.artifact": { priority: 0 },
    },
  };
}
