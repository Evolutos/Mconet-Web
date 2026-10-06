// Copyright © 2026 Mcont.

import type { ArtifactMetadata } from "./artifact-metadata.js";
import type { OpenIdentifier } from "./open-identifier.js";

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
