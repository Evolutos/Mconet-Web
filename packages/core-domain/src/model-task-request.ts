// Copyright © 2026 Mcont.

import type { ArtifactCatalog } from "./artifact-catalog.js";
import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { TaskDescriptor } from "./task-descriptor.js";
import type { TaskDocument } from "./task-document.js";

/**
 * Immutable open contract for one model-task request.
 *
 * Task identity, its versioned document, request-local Artifact scope, metadata,
 * and extensions remain independent owned values. Structural typing allows new
 * task families to extend this data contract without SDK inheritance or a Core
 * registry. Model targets, access data, credentials, protocol payloads,
 * transport state, and execution behavior belong outside this Task boundary.
 */
export interface ModelTaskRequest {
  /** Open descriptor naming the task family and optional Schema contracts. */
  readonly descriptor: TaskDescriptor;

  /** Complete versioned tree containing task inputs and configuration. */
  readonly document: TaskDocument;

  /** Concrete request-local scope for every Artifact reference in the task. */
  readonly artifacts: ArtifactCatalog;

  /** Always-present JSON-compatible descriptive request metadata. */
  readonly metadata: Readonly<Record<string, JsonValue>>;

  /** Always-present namespaced extensions for forward-compatible request data. */
  readonly extensions: Extensions;
}
