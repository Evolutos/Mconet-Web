// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Data-only open abstraction classifying optional Artifact modality details.
 *
 * Concrete descriptors may add image, audio, video, vector, tensor, or future
 * fields. This base intentionally carries only an open kind and never embeds
 * source bytes, media access, validation, transformation, or executable behavior.
 */
export interface ArtifactDescriptor {
  /** Standard or integration-defined open descriptor classification. */
  readonly kind: OpenIdentifier;
}
