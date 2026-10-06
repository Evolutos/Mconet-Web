// Copyright © 2026 Mcont.

import type { ArtifactSource } from "./artifact-source.js";
import type { UriValue } from "./uri-value.js";

/**
 * Immutable URI-reference representation for one Artifact source.
 *
 * The fixed kind distinguishes a referenced resource from inline bytes and
 * other source forms. UriValue preserves whether base resolution is required;
 * this data-only contract does not resolve, normalize, authorize, fetch, cache,
 * download, or otherwise access the referenced resource.
 */
export interface UriArtifactSource extends ArtifactSource {
  /** Fixed discriminator for a URI-referenced Artifact source. */
  readonly kind: "artifact.source.uri";

  /** Absolute or relative URI reference retained without resolution or rewrite. */
  readonly uri: UriValue;
}
