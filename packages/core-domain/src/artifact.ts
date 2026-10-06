// Copyright © 2026 Mcont.

import type { ArtifactDescriptor } from "./artifact-descriptor.js";
import type { ArtifactKind } from "./artifact-kind.js";
import type { ArtifactMetadata } from "./artifact-metadata.js";
import type { ArtifactSource } from "./artifact-source.js";
import type { Extensions } from "./extensions.js";

/**
 * Immutable data contract for one externally stored or inline Artifact.
 *
 * Identity and classification remain separate from source representation and
 * optional modality description. The contract preserves wire media-type text,
 * metadata, and extensions without reading, downloading, uploading, decoding,
 * converting, validating, or selecting runtime components.
 */
export interface Artifact {
  /** Catalog-local Artifact identity. */
  readonly id: string;

  /** Open Artifact classification with optional semantics and extensions. */
  readonly kind: ArtifactKind;

  /** Original media type text when the producing boundary supplied one. */
  readonly mediaType?: string;

  /** Inline or referenced representation from which Artifact data may be read. */
  readonly source: ArtifactSource;

  /** Optional modality-specific descriptive data. */
  readonly descriptor?: ArtifactDescriptor;

  /** Always-present JSON-compatible descriptive metadata. */
  readonly metadata: ArtifactMetadata;

  /** Always-present namespaced extension data for forward compatibility. */
  readonly extensions: Extensions;
}
