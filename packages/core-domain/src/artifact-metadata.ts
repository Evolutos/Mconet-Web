// Copyright © 2026 Mcont.

import type { JsonValue } from "./json-value.js";

/**
 * Immutable JSON-compatible descriptive data attached to one Artifact.
 *
 * The open string-keyed map preserves application and integration metadata
 * without defining media-specific fields in core-domain. Values remain plain
 * data only; callbacks, components, credentials, streams, handles, and other
 * executable or runtime-owned objects are outside this contract.
 */
export interface ArtifactMetadata {
  /** JSON-compatible metadata value stored under an application-defined key. */
  readonly [key: string]: JsonValue;
}
