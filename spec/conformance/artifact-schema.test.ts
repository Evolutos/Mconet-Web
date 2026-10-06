// Copyright © 2026 Mcont.

import { beforeAll, describe, expect, it } from "vitest";

import { isArtifact } from "../../packages/core-domain/src/artifact.js";
import { loadSchemaById } from "../schema-loader.js";
import { SchemaValidatorAdapter } from "../schema-validator-adapter.js";

/** Stable identifier of the self-contained Artifact Schema. */
const artifactSchemaId = "https://schemas.evolutos.com/mconet/artifact";

/** Existing Schema supplying independently reviewed shared JSON definitions. */
const modelDescriptorSchemaId = "https://schemas.evolutos.com/mconet/model/descriptor";

/** Existing Schema supplying independently reviewed URI value definitions. */
const baseTypeFixtureSchemaId = "https://schemas.evolutos.com/mconet/base/type-fixture";

/** Artifact Schema loaded from the committed registry. */
let artifactSchema: Readonly<Record<string, unknown>>;

/** Existing Schema used to detect shared identifier and JSON definition drift. */
let modelDescriptorSchema: Readonly<Record<string, unknown>>;

/** Existing Schema used to detect shared URI definition drift. */
let baseTypeFixtureSchema: Readonly<Record<string, unknown>>;

/** Strict compiled validator reused by every Artifact conformance case. */
let schemaValidator: SchemaValidatorAdapter;

beforeAll(async () => {
  // Resolve every document through the production loader so registry identity,
  // deep freezing, definition consistency, and strict compilation are exercised.
  artifactSchema = await loadSchemaById(artifactSchemaId);
  modelDescriptorSchema = await loadSchemaById(modelDescriptorSchemaId);
  baseTypeFixtureSchema = await loadSchemaById(baseTypeFixtureSchemaId);
  schemaValidator = new SchemaValidatorAdapter(artifactSchema);
});

describe("Artifact Schema", () => {
  // Keep structural, runtime-agreement, binary-boundary, openness, and mutation
  // checks together as the acceptance surface for this one Schema document.
  it("declares the stable identity and complete Artifact envelope", () => {
    // Exact keyword values detect identity, required-field, ordering, or
    // forward-compatibility drift independently from representative Fixtures.
    expect(artifactSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(artifactSchema.$id).toBe(artifactSchemaId);
    expect(artifactSchema.required).toEqual(["id", "kind", "source", "metadata", "extensions"]);
    expect(Object.keys(artifactSchema.properties as Record<string, unknown>)).toEqual([
      "id",
      "kind",
      "mediaType",
      "source",
      "descriptor",
      "metadata",
      "extensions",
    ]);
    expect(artifactSchema.additionalProperties).toBe(true);
    expect(Object.isFrozen(artifactSchema)).toBe(true);
  });

  it("keeps shared identifier JSON and URI definitions aligned", () => {
    const artifactDefinitions = artifactSchema.$defs as Record<string, unknown>;
    const descriptorDefinitions = modelDescriptorSchema.$defs as Record<string, unknown>;
    const baseDefinitions = baseTypeFixtureSchema.$defs as Record<string, unknown>;

    // Whole-definition comparison prevents this self-contained Schema from
    // silently changing established portable value semantics.
    for (const definitionName of [
      "openIdentifier",
      "jsonPrimitive",
      "jsonValue",
      "jsonRecord",
    ] as const) {
      expect(artifactDefinitions[definitionName]).toEqual(descriptorDefinitions[definitionName]);
    }
    for (const definitionName of ["uriValue", "absoluteUriValue", "relativeUriValue"] as const) {
      expect(artifactDefinitions[definitionName]).toEqual(baseDefinitions[definitionName]);
    }
  });

  it("accepts one complete inline Artifact in both contracts", () => {
    const fixture = createCompleteArtifactFixture();
    const source = fixture.source;
    const kind = fixture.kind;

    // The same in-memory Fixture covers structured kind, quoted media parameters,
    // Uint8Array bytes, descriptor fields, Unicode metadata, and extensions.
    expect(isArtifact(fixture)).toBe(true);
    expect(schemaValidator.validate(fixture)).toBe(true);

    // Neither validator replaces runtime-owned or descriptive nested values.
    expect(fixture.source).toBe(source);
    expect(fixture.kind).toBe(kind);
  });

  it("accepts URI and integration-defined sources in both contracts", () => {
    const uriFixture = createCompleteArtifactFixture();
    uriFixture.source = {
      kind: "artifact.source.uri",
      uri: {
        kind: "relative",
        value: "../assets/image.png",
      },
    };
    const customFixture = createCompleteArtifactFixture();
    customFixture.source = {
      kind: "provider.source.handle",
      handleId: "asset-handle-1",
      repeatable: false,
    };

    // Known URI sources enforce their explicit value object; unknown kinds remain
    // structurally open for defining integrations without core interpretation.
    expect(isArtifact(uriFixture)).toBe(true);
    expect(schemaValidator.validate(uriFixture)).toBe(true);
    expect(isArtifact(customFixture)).toBe(true);
    expect(schemaValidator.validate(customFixture)).toBe(true);
  });

  it("accepts true omission of media type and descriptor", () => {
    const fixture = createCompleteArtifactFixture();
    expect(Reflect.deleteProperty(fixture, "mediaType")).toBe(true);
    expect(Reflect.deleteProperty(fixture, "descriptor")).toBe(true);

    // Optional data remains absent without null or undefined sentinels, and no
    // validator fabricates defaults for either field.
    expect(isArtifact(fixture)).toBe(true);
    expect(schemaValidator.validate(fixture)).toBe(true);
    expect(Object.hasOwn(fixture, "mediaType")).toBe(false);
    expect(Object.hasOwn(fixture, "descriptor")).toBe(false);
  });

  it.each([
    {
      label: "missing identity",
      mutate: (fixture: Record<string, unknown>) => {
        // Remove exactly one required root member for this isolated case.
        Reflect.deleteProperty(fixture, "id");
      },
    },
    {
      label: "invalid identity",
      mutate: (fixture: Record<string, unknown>) => {
        // Catalog-local identities reuse the open-identifier syntax boundary.
        fixture.id = "invalid artifact id";
      },
    },
    {
      label: "bare kind string",
      mutate: (fixture: Record<string, unknown>) => {
        // ArtifactKind is a structured open value, not a bare discriminator.
        fixture.kind = "artifact.image";
      },
    },
    {
      label: "kind without extensions",
      mutate: (fixture: Record<string, unknown>) => {
        // Every ArtifactKind carries an explicit forward-compatible extension map.
        fixture.kind = { id: "artifact.image" };
      },
    },
    {
      label: "invalid media type",
      mutate: (fixture: Record<string, unknown>) => {
        // A present raw media-type string must include valid type/subtype syntax.
        fixture.mediaType = "image";
      },
    },
    {
      label: "inline source without bytes",
      mutate: (fixture: Record<string, unknown>) => {
        // A known inline discriminator cannot fall back to the open source arm.
        fixture.source = { kind: "artifact.source.inline" };
      },
    },
    {
      label: "URI source with a bare string",
      mutate: (fixture: Record<string, unknown>) => {
        // URI sources require an explicit absolute/relative UriValue object.
        fixture.source = {
          kind: "artifact.source.uri",
          uri: "https://assets.example.invalid/image.png",
        };
      },
    },
    {
      label: "descriptor without kind",
      mutate: (fixture: Record<string, unknown>) => {
        // Present modality descriptions always begin with an open kind.
        fixture.descriptor = { width: 1, height: 1 };
      },
    },
    {
      label: "non-JSON metadata",
      mutate: (fixture: Record<string, unknown>) => {
        // Artifact metadata is recursively portable data and excludes functions.
        fixture.metadata = { callback: () => undefined };
      },
    },
    {
      label: "non-record extensions",
      mutate: (fixture: Record<string, unknown>) => {
        // Namespaced extensions are always represented by a JSON object map.
        fixture.extensions = [];
      },
    },
  ])("rejects $label in both contracts", ({ mutate }) => {
    const fixture = createCompleteArtifactFixture();

    // Each fresh Fixture contains one structural fault, proving Schema/runtime
    // agreement without mutation leakage between parameterized cases.
    mutate(fixture);
    expect(isArtifact(fixture)).toBe(false);
    expect(schemaValidator.validate(fixture)).toBe(false);
  });

  it("keeps the language-neutral binary encoding deliberately unspecified", () => {
    const fixture = createCompleteArtifactFixture();
    fixture.source = {
      kind: "artifact.source.inline",
      bytes: [0, 1, 2, 255],
    };

    // Schema requires the bytes member but does not choose a cross-language JSON
    // binary encoding. The Web runtime independently requires Uint8Array.
    expect(schemaValidator.validate(fixture)).toBe(true);
    expect(isArtifact(fixture)).toBe(false);
  });

  it("preserves unknown fields at every open Artifact layer", () => {
    const fixture = createCompleteArtifactFixture();
    fixture.futureArtifactField = { retained: true };
    (fixture.kind as Record<string, unknown>).futureKindField = "retained";
    (fixture.source as Record<string, unknown>).futureSourceField = 0;
    (fixture.descriptor as Record<string, unknown>).futureDescriptorField = false;

    // Forward-compatible fields survive both structural checks because each
    // open contract uses additionalProperties without interpreting the values.
    expect(isArtifact(fixture)).toBe(true);
    expect(schemaValidator.validate(fixture)).toBe(true);
  });

  it("does not mutate valid or invalid Fixture data", () => {
    const validFixture = createCompleteArtifactFixture();
    const invalidFixture = createCompleteArtifactFixture();
    invalidFixture.mediaType = "invalid";
    const originalValidFixture = structuredClone(validFixture);
    const originalInvalidFixture = structuredClone(invalidFixture);

    // Adapter mutation features are disabled, and runtime validation retains the
    // original byte view, field order, nested data, and invalid source text.
    expect(schemaValidator.validate(validFixture)).toBe(true);
    expect(isArtifact(validFixture)).toBe(true);
    expect(schemaValidator.validate(invalidFixture)).toBe(false);
    expect(isArtifact(invalidFixture)).toBe(false);
    expect(validFixture).toEqual(originalValidFixture);
    expect(invalidFixture).toEqual(originalInvalidFixture);
  });
});

/** Creates one complete representative Artifact without relying on later Fixtures. */
function createCompleteArtifactFixture(): Record<string, unknown> {
  // Allocate every nested field explicitly so each conformance mutation remains
  // independent and no Builder or Catalog behavior enters this Schema step.
  return {
    id: "artifact-image-1",
    kind: {
      id: "provider.design_asset",
      semantic: "image",
      extensions: {
        "provider.kind": { renderable: true },
      },
    },
    mediaType: 'image/png; charset="utf-8"; profile="preview; still"',
    source: {
      kind: "artifact.source.inline",
      bytes: new Uint8Array([0, 1, 2, 255]),
    },
    descriptor: {
      kind: "artifact.descriptor.image",
      width: 1,
      height: 1,
    },
    metadata: {
      featured: false,
      rank: 0,
      labels: ["preview", "示例"],
    },
    extensions: {
      "provider.artifact": { downloadable: false },
    },
  };
}
