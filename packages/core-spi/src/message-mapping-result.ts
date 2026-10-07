// Copyright © 2026 Mcont.

import type { ArtifactCatalog, MessageDocument } from "@evolutos/mconet-core-domain";

/**
 * Immutable message-domain facts recovered from one protocol fragment.
 *
 * The document and its result-local Artifact Catalog cross the mapping boundary
 * together so references cannot be separated from the Catalog that resolves
 * them. This value does not decode bytes, resolve Artifact content, assemble a
 * task result, interpret transport metadata, or mutate either domain value.
 */
export interface MessageMappingResult {
  /** Message structure reconstructed from the mapped protocol fragment. */
  readonly document: MessageDocument;

  /** Ordered result-local Artifacts referenced by the reconstructed document. */
  readonly artifacts: ArtifactCatalog;
}
