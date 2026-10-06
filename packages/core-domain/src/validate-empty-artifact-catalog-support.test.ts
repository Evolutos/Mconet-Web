// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type { Artifact } from "./artifact.js";
import type { ArtifactCatalog } from "./artifact-catalog.js";
import { validateEmptyArtifactCatalogSupport } from "./validate-empty-artifact-catalog-support.js";

it("accepts an explicit empty Catalog by identity", () => {
  const artifacts: readonly Artifact[] = [];
  const catalog: ArtifactCatalog = { artifacts };
  const result = validateEmptyArtifactCatalogSupport(catalog);

  // Empty support uses the caller's real Catalog and collection rather than null,
  // omission, or an allocated replacement value.
  expect(result).toEqual({ value: catalog, diagnostics: [] });
  expect(result.value).toBe(catalog);
  expect(result.value?.artifacts).toBe(artifacts);
});

it("returns the stable unsupported-content diagnostic for one Artifact", () => {
  const artifact = createUnsupportedArtifact("artifact-one");
  const catalog: ArtifactCatalog = { artifacts: [artifact] };
  const result = validateEmptyArtifactCatalogSupport(catalog);

  // A rejected Catalog omits value and reports only count and collection path,
  // avoiding source bytes, URIs, metadata, or extension disclosure.
  expect(Object.hasOwn(result, "value")).toBe(false);
  expect(result.diagnostics).toEqual([
    {
      code: "unsupported_message_content",
      severity: "error",
      phase: "validation",
      message: "Artifacts are not supported by this execution path.",
      path: "artifacts",
      details: {
        artifactCount: 1,
      },
    },
  ]);
});

it("reports the exact non-empty collection count", () => {
  const catalog: ArtifactCatalog = {
    artifacts: [
      createUnsupportedArtifact("artifact-first"),
      createUnsupportedArtifact("artifact-second"),
      createUnsupportedArtifact("artifact-third"),
    ],
  };

  // Cardinality is a portable diagnostic fact and does not require inspecting
  // any Artifact field beyond the containing collection length.
  expect(validateEmptyArtifactCatalogSupport(catalog).diagnostics[0]?.details).toEqual({
    artifactCount: 3,
  });
});

it("does not permit duplicates to bypass the unsupported range", () => {
  const catalog: ArtifactCatalog = {
    artifacts: [
      createUnsupportedArtifact("artifact-duplicate"),
      createUnsupportedArtifact("artifact-duplicate"),
    ],
  };

  // This range gate rejects all non-empty Catalogs before uniqueness becomes
  // relevant; it never treats duplicate collapse as an empty effective set.
  expect(validateEmptyArtifactCatalogSupport(catalog).diagnostics[0]).toMatchObject({
    code: "unsupported_message_content",
    details: { artifactCount: 2 },
  });
});

it("does not mutate a rejected Catalog or inspect source data", () => {
  const source = {
    kind: "provider.source.unreadable",
    handleId: "opaque-source-handle",
  };
  const artifact: Artifact = {
    id: "artifact-stable",
    kind: { id: "artifact.unknown", extensions: {} },
    source,
    metadata: { original: true },
    extensions: {},
  };
  const artifacts = [artifact] as const;
  const catalog: ArtifactCatalog = { artifacts };

  validateEmptyArtifactCatalogSupport(catalog);

  // Collection, Artifact, source, and metadata identities remain unchanged; the
  // range check observes only the array length.
  expect(catalog.artifacts).toBe(artifacts);
  expect(catalog.artifacts[0]).toBe(artifact);
  expect(artifact.source).toBe(source);
  expect(artifact.metadata).toEqual({ original: true });
});

/** Creates one minimal Artifact whose presence is unsupported by this validator. */
function createUnsupportedArtifact(id: string): Artifact {
  // Allocate a fresh value per call so count and duplicate cases do not depend on
  // shared object identity or mutate another test's data.
  return {
    id,
    kind: { id: "artifact.unknown", extensions: {} },
    source: { kind: "provider.source.fixture" },
    metadata: {},
    extensions: {},
  };
}
