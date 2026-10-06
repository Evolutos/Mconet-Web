// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { OpenIdentifier } from "./open-identifier.js";

/**
 * Immutable open description of one model-task contract.
 *
 * Task type identifies the task family independently from its optional version
 * and input/output Schema identities. Metadata and extensions remain portable
 * descriptive data. This interface carries no interaction mode, TaskDocument,
 * ArtifactCatalog, model target, service access, protocol, or execution behavior.
 * Untrusted values require the separate runtime validator implemented later.
 */
export interface TaskDescriptor {
  /** Standard or integration-defined task-family identity. */
  readonly type: OpenIdentifier;

  /** Optional opaque version of the selected task contract. */
  readonly version?: string;

  /** Optional identity of the task input Schema. */
  readonly inputSchemaId?: string;

  /** Optional identity of the task output Schema. */
  readonly outputSchemaId?: string;

  /** Always-present JSON-compatible descriptive task metadata. */
  readonly metadata: Readonly<Record<string, JsonValue>>;

  /** Always-present namespaced extensions for forward-compatible task data. */
  readonly extensions: Extensions;
}
