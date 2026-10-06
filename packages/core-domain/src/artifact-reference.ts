// Copyright © 2026 Mcont.

import type { ArtifactCatalog } from "./artifact-catalog.js";
import { validateArtifactCatalogIds } from "./artifact-catalog.js";
import type { Artifact } from "./artifact.js";
import type { ArtifactMetadata } from "./artifact-metadata.js";
import type { OpenIdentifier } from "./open-identifier.js";
import type { ProcessingResult } from "./processing-result.js";

/**
 * Immutable reference to an Artifact in the containing request or result catalog.
 *
 * The reference stores only a catalog-local identity plus optional descriptive
 * relation and metadata. It never embeds an Artifact, resolution scope, lookup
 * callback, reader, uploader, or cross-request location.
 */
export interface ArtifactReference {
  /** Artifact identity resolved only against the containing ArtifactCatalog. */
  readonly artifactId: string;

  /** Optional standard or integration-defined relationship to the Artifact. */
  readonly relation?: OpenIdentifier;

  /** Always-present JSON-compatible data describing this reference. */
  readonly metadata: ArtifactMetadata;
}

/**
 * Resolves one ArtifactReference only within the explicitly supplied Catalog.
 *
 * Catalog identity uniqueness is validated before lookup so an ambiguous scope
 * never produces a value. Resolution compares `artifactId` strings exactly and
 * returns the original Artifact by identity; relation and metadata remain
 * descriptive and do not influence lookup or trigger I/O.
 *
 * @param reference Catalog-local Artifact reference to resolve.
 * @param catalog The complete and only lookup scope for this resolution.
 * @returns The referenced Artifact, or one stable resolution diagnostic.
 */
export function resolveArtifactReference(
  reference: ArtifactReference,
  catalog: ArtifactCatalog,
): ProcessingResult<Artifact> {
  const catalogValidation = validateArtifactCatalogIds(catalog);
  if (catalogValidation.value === undefined) {
    // Preserve the deterministic duplicate-ID diagnostic instead of selecting an
    // arbitrary Artifact from an invalid or ambiguous Catalog.
    return { diagnostics: catalogValidation.diagnostics };
  }

  for (const artifact of catalogValidation.value.artifacts) {
    // Strict string identity preserves case and Unicode exactly. Returning the
    // existing object avoids copying source handles, bytes, metadata, or extensions.
    if (artifact.id === reference.artifactId) {
      return {
        value: artifact,
        diagnostics: [],
      };
    }
  }

  // Absence is a normal non-throwing resolution failure with no fabricated
  // Artifact, global fallback, network lookup, or cross-Catalog search.
  return {
    diagnostics: [
      {
        code: "artifact_reference_not_found",
        severity: "error",
        phase: "resolution",
        message: "The referenced Artifact does not exist in the supplied Catalog.",
        path: "artifactId",
        details: {
          artifactId: reference.artifactId,
        },
      },
    ],
  };
}
