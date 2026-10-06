// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Immutable open classification for one Artifact value.
 *
 * The identifier preserves standard, integration-defined, and future kinds
 * without closing the vocabulary in core-domain. Optional semantic text can
 * record normalized meaning independently from identity, while extensions retain
 * namespaced JSON data. This data-only abstraction performs no reading, upload,
 * download, conversion, media inference, component selection, or control flow.
 */
export interface ArtifactKind {
  /** Standard or integration-defined open Artifact kind identifier. */
  readonly id: OpenIdentifier;

  /** Optional normalized meaning retained independently from kind identity. */
  readonly semantic?: string;

  /** Always-present namespaced extension data for forward compatibility. */
  readonly extensions: Extensions;
}
