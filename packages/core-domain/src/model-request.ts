// Copyright © 2026 Mcont.

import { isConversationTaskRequest } from "./conversation-task-request.js";
import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import { getRecordDescriptors, isDataDescriptor } from "./message-entry.js";
import { isJsonRecord } from "./model-descriptor.js";
import { isModelTarget, type ModelTarget } from "./model-target.js";
import type { ModelTaskRequest } from "./model-task-request.js";
import { isServiceAccess, type ServiceAccess } from "./service-access.js";

/**
 * Immutable task-neutral envelope for one model interaction request.
 *
 * Target selection, the open task request, optional request-level access input,
 * metadata, and extensions remain independent values. Task-specific parameters
 * stay inside the TaskDocument; interaction mode, runtime options, components,
 * protocol payloads and transport state belong to later layers. Runtime
 * validation below composes the dedicated target, task, and access predicates.
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

/**
 * Determines whether an unknown value is a supported model request envelope.
 *
 * Target, conversation Task, and optional access input delegate to their complete
 * validators. This boundary does not infer protocol from model or endpoint data,
 * resolve access defaults, select components, construct payloads, or perform I/O.
 * Unknown top-level fields remain structurally available and are not consulted.
 *
 * @param value Untrusted interaction request to validate.
 * @returns Whether the value satisfies the supported {@link ModelRequest} contract.
 */
export function isModelRequest(value: unknown): value is ModelRequest {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return false;
  }

  const targetDescriptor = descriptors.target;
  const taskDescriptor = descriptors.task;
  const serviceAccessDescriptor = descriptors.serviceAccess;
  const metadataDescriptor = descriptors.metadata;
  const extensionsDescriptor = descriptors.extensions;

  // Required boundaries use own stored values. The current executable task
  // range is conversation generation and remains isolated behind its predicate.
  return (
    isDataDescriptor(targetDescriptor) &&
    isModelTarget(targetDescriptor.value) &&
    isDataDescriptor(taskDescriptor) &&
    isConversationTaskRequest(taskDescriptor.value) &&
    isOptionalServiceAccess(serviceAccessDescriptor) &&
    isDataDescriptor(metadataDescriptor) &&
    isJsonRecord(metadataDescriptor.value, new Set<object>()) &&
    isDataDescriptor(extensionsDescriptor) &&
    isJsonRecord(extensionsDescriptor.value, new Set<object>())
  );
}

/** Validates exact absence or one own stored ServiceAccess contribution. */
function isOptionalServiceAccess(descriptor: PropertyDescriptor | undefined): boolean {
  // Explicit undefined and accessors are not omission. Nested endpoint,
  // authorization, header, query, and extension rules remain delegated.
  return (
    descriptor === undefined || (isDataDescriptor(descriptor) && isServiceAccess(descriptor.value))
  );
}
