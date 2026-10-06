// Copyright © 2026 Mcont.

import type { Artifact } from "./artifact.js";

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
