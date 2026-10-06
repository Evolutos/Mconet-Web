// Copyright © 2026 Mcont.

import type { ArtifactCatalog } from "./artifact-catalog.js";
import type { ProcessingResult } from "./processing-result.js";

/**
 * Validates that an execution path which cannot send Artifacts receives an empty Catalog.
 *
 * The function checks collection cardinality only. It does not validate Artifact
 * structure or IDs, resolve references, read sources, transfer data, or mutate
 * the Catalog, and therefore remains independent from those dedicated stages.
 *
 * @param catalog Structurally valid ArtifactCatalog to inspect.
 * @returns The original empty Catalog, or one unsupported-content diagnostic.
 */
export function validateEmptyArtifactCatalogSupport(
  catalog: ArtifactCatalog,
): ProcessingResult<ArtifactCatalog> {
  if (catalog.artifacts.length > 0) {
    // Reject before any Artifact inspection or access. Count is sufficient to
    // explain the unsupported request without exposing source or metadata data.
    return {
      diagnostics: [
        {
          code: "unsupported_message_content",
          severity: "error",
          phase: "validation",
          message: "Artifacts are not supported by this execution path.",
          path: "artifacts",
          details: {
            artifactCount: catalog.artifacts.length,
          },
        },
      ],
    };
  }

  // Preserve the caller's explicit empty Catalog by identity and avoid creating
  // an implicit singleton, default source, or replacement collection.
  return {
    value: catalog,
    diagnostics: [],
  };
}
