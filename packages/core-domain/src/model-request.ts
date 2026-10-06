// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { ModelTarget } from "./model-target.js";
import type { ModelTaskRequest } from "./model-task-request.js";
import type { ServiceAccess } from "./service-access.js";

/**
 * Immutable task-neutral envelope for one model interaction request.
 *
 * Target selection, the open task request, optional request-level access input,
 * metadata, and extensions remain independent values. Task-specific parameters
 * stay inside the TaskDocument; interaction mode, runtime options, components,
 * validation, protocol payloads, and transport state belong to later layers.
 */
export interface ModelRequest {
  /** Service, protocol, deployment, and model selected for the interaction. */
  readonly target: ModelTarget;

  /** Open task request retained without assuming a concrete task family. */
  readonly task: ModelTaskRequest;

  /** Optional unresolved access contribution scoped to this request. */
  readonly serviceAccess?: ServiceAccess;

  /** Always-present JSON-compatible descriptive interaction metadata. */
  readonly metadata: Readonly<Record<string, JsonValue>>;

  /** Always-present namespaced extensions for forward-compatible request data. */
  readonly extensions: Extensions;
}
