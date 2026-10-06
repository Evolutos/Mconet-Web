// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Data-only open abstraction describing how an Artifact source is classified.
 *
 * Concrete source interfaces add only their own representation fields. This
 * base deliberately contains no bytes, URI, file path, stream, authorization,
 * reader, uploader, resolver, callback, or I/O behavior, so declaring a source
 * never performs access or implies that the current runtime supports its kind.
 */
export interface ArtifactSource {
  /** Standard or integration-defined open source classification. */
  readonly kind: OpenIdentifier;
}
