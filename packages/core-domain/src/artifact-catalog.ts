// Copyright © 2026 Mcont.

import type { Artifact } from "./artifact.js";
import type { ProcessingResult } from "./processing-result.js";

/**
 * Immutable collection that scopes Artifact identities for one request or result.
 *
 * An empty Catalog is represented by an empty array, never null or an omitted
 * field. Identity uniqueness, reference resolution, validation, reading, and
 * transformation remain separate operations and are not performed by this type.
 */
export interface ArtifactCatalog {
  /** Ordered Artifacts whose IDs share this Catalog's local resolution scope. */
  readonly artifacts: readonly Artifact[];
}

/**
 * Validates that every Artifact ID is unique within one Catalog.
 *
 * The first duplicate in collection order produces one stable error diagnostic
 * and no value. Successful validation returns the original Catalog by identity.
 * This function assumes individual Artifacts already satisfy their own contract;
 * it does not validate fields, resolve references, build an index, or mutate data.
 *
 * @param catalog Catalog whose local Artifact identities are checked.
 * @returns The unchanged Catalog on success, or a duplicate-ID diagnostic.
 */
export function validateArtifactCatalogIds(
  catalog: ArtifactCatalog,
): ProcessingResult<ArtifactCatalog> {
  const firstIndexById = new Map<string, number>();

  for (const [index, artifact] of catalog.artifacts.entries()) {
    const firstIndex = firstIndexById.get(artifact.id);
    if (firstIndex !== undefined) {
      // Stop at the first duplicate in stable collection order so callers receive
      // one deterministic primary failure rather than order-dependent aggregation.
      return {
        diagnostics: [
          {
            code: "duplicate_artifact_id",
            severity: "error",
            phase: "validation",
            message: "Artifact IDs must be unique within one Catalog.",
            path: `artifacts[${index}].id`,
            details: {
              artifactId: artifact.id,
              firstIndex,
              duplicateIndex: index,
            },
          },
        ],
      };
    }

    // Remember only the first position for each identity; later duplicates can
    // report the original conflicting Artifact without replacing index state.
    firstIndexById.set(artifact.id, index);
  }

  // Preserve Catalog identity and order exactly; validation allocates no copy or
  // long-lived lookup index for a successful value.
  return {
    value: catalog,
    diagnostics: [],
  };
}
