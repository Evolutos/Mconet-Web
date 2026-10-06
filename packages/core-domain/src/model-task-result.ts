// Copyright © 2026 Mcont.

import type { ArtifactCatalog } from "./artifact-catalog.js";
import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { TaskDescriptor } from "./task-descriptor.js";
import type { TaskDocument } from "./task-document.js";

/**
 * Immutable open contract for one model-task result.
 *
 * Task identity, its versioned result document, result-local Artifact scope,
 * metadata, and extensions remain independent owned values. Structural typing
 * allows new task families to define result contracts without SDK inheritance
 * or a Core registry. Request inputs, model identity, output status, usage,
 * diagnostics, protocol state, and transport behavior belong outside this
 * task-result boundary.
 */
export interface ModelTaskResult {
  /** Open descriptor naming the task-result family and Schema contracts. */
  readonly descriptor: TaskDescriptor;

  /** Complete versioned tree containing the task's authoritative result. */
  readonly document: TaskDocument;

  /** Concrete result-local scope for every Artifact reference in the result. */
  readonly artifacts: ArtifactCatalog;

  /** Always-present JSON-compatible descriptive result metadata. */
  readonly metadata: Readonly<Record<string, JsonValue>>;

  /** Always-present namespaced extensions for forward-compatible result data. */
  readonly extensions: Extensions;
}
