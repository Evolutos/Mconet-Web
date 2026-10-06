// Copyright © 2026 Mcont.

import type { ArtifactSource } from "./artifact-source.js";
import type { Bytes } from "./bytes.js";

/**
 * Immutable-by-contract inline byte representation for one Artifact source.
 *
 * The fixed kind distinguishes directly supplied bytes from URI, file, stream,
 * or provider-managed sources. The readonly field protects only the byte-view
 * reference; the shared Bytes contract deliberately makes no copying, backing
 * buffer ownership, or deep immutability promise. This value triggers no I/O.
 */
export interface InlineArtifactSource extends ArtifactSource {
  /** Fixed discriminator for an in-memory inline byte source. */
  readonly kind: "artifact.source.inline";

  /** Caller-owned byte view retained without copying or interpretation. */
  readonly bytes: Bytes;
}
