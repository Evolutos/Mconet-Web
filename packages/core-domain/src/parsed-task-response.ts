// Copyright © 2026 Mcont.

import { isArtifact } from "./artifact.js";
import { validateArtifactCatalogIds, type ArtifactCatalog } from "./artifact-catalog.js";
import type { Extensions } from "./extensions.js";
import type { FinishReason } from "./finish-reason.js";
import {
  getDenseArrayDescriptors,
  getRecordDescriptors,
  isDataDescriptor,
} from "./message-entry.js";
import { isJsonRecord, isModelDescriptor, type ModelDescriptor } from "./model-descriptor.js";
import type { ModelTaskResult } from "./model-task-result.js";
import { isOpenIdentifier } from "./open-identifier.js";
import type { OutputStatus } from "./output-status.js";
import type { ProtocolState } from "./protocol-state.js";
import { isTaskDescriptor } from "./task-descriptor.js";
import { isTaskDocument } from "./task-document.js";
import type { TokenUsage } from "./token-usage.js";

/**
 * Immutable protocol facts parsed from one model-service response.
 *
 * Optional values remain absent when the service did not report them; adapters
 * must not synthesize them from request or integration configuration. Request
 * target, Runtime diagnostics, interaction identity, transport observations,
 * and output assembly remain outside this parsed-response boundary.
 */
export interface ParsedTaskResponse {
  /** Task-neutral result parsed from the response payload. */
  readonly result: ModelTaskResult;

  /** Actual model identity only when explicitly reported by the service. */
  readonly resolvedModel?: ModelDescriptor;

  /** Required service-reported or protocol-derived output status. */
  readonly status: OutputStatus;

  /** Exact open reason only when explicitly reported by the protocol. */
  readonly stopReason?: FinishReason;

  /** Token accounting only when explicitly reported by the service. */
  readonly usage?: TokenUsage;

  /** Ordered protocol continuation and service-state facts. */
  readonly protocolState: readonly ProtocolState[];

  /** Always-present unknown protocol fields retained without promotion. */
  readonly extensions: Extensions;
}

/**
 * Determines whether an unknown value contains complete parsed response facts.
 *
 * Required facts are validated exactly as reported. Optional model identity,
 * finish reason, and usage use exact absence semantics, so validation never
 * fabricates them from request or result data. The predicate performs no output
 * assembly, diagnostics, protocol interpretation, normalization, or mutation.
 *
 * @param value Untrusted parsed response value to validate.
 * @returns Whether the value satisfies {@link ParsedTaskResponse}.
 */
export function isParsedTaskResponse(value: unknown): value is ParsedTaskResponse {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return false;
  }

  const resultDescriptor = descriptors.result;
  const statusDescriptor = descriptors.status;
  const protocolStateDescriptor = descriptors.protocolState;
  const extensionsDescriptor = descriptors.extensions;

  // Required facts must be own stored values. Optional helpers distinguish true
  // absence from an accessor or explicitly stored undefined value.
  return (
    isDataDescriptor(resultDescriptor) &&
    isModelTaskResult(resultDescriptor.value) &&
    isOptionalModelDescriptor(descriptors.resolvedModel) &&
    isDataDescriptor(statusDescriptor) &&
    isOpenIdentifier(statusDescriptor.value) &&
    isOptionalOpenIdentifier(descriptors.stopReason) &&
    isOptionalTokenUsage(descriptors.usage) &&
    isDataDescriptor(protocolStateDescriptor) &&
    isProtocolStateArray(protocolStateDescriptor.value) &&
    isDataDescriptor(extensionsDescriptor) &&
    isJsonRecord(extensionsDescriptor.value, new Set<object>())
  );
}

/** Validates the complete task-neutral result carried by the parsed response. */
function isModelTaskResult(value: unknown): value is ModelTaskResult {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return false;
  }

  const descriptorDescriptor = descriptors.descriptor;
  const documentDescriptor = descriptors.document;
  const artifactsDescriptor = descriptors.artifacts;
  const metadataDescriptor = descriptors.metadata;
  const extensionsDescriptor = descriptors.extensions;
  return (
    isDataDescriptor(descriptorDescriptor) &&
    isTaskDescriptor(descriptorDescriptor.value) &&
    isDataDescriptor(documentDescriptor) &&
    isTaskDocument(documentDescriptor.value) &&
    isDataDescriptor(artifactsDescriptor) &&
    isArtifactCatalog(artifactsDescriptor.value) &&
    isDataDescriptor(metadataDescriptor) &&
    isJsonRecord(metadataDescriptor.value, new Set<object>()) &&
    isDataDescriptor(extensionsDescriptor) &&
    isJsonRecord(extensionsDescriptor.value, new Set<object>())
  );
}

/** Validates every result-local Artifact and its Catalog-local identity scope. */
function isArtifactCatalog(value: unknown): value is ArtifactCatalog {
  const descriptors = getRecordDescriptors(value);
  const artifactsDescriptor = descriptors?.artifacts;
  if (!isDataDescriptor(artifactsDescriptor)) {
    return false;
  }

  const artifactDescriptors = getDenseArrayDescriptors(artifactsDescriptor.value);
  if (artifactDescriptors === undefined) {
    return false;
  }
  for (const artifactDescriptor of artifactDescriptors) {
    // Individual Artifact validation owns source, descriptor, metadata, and
    // extension structure without reading external bytes or URI resources.
    if (!isArtifact(artifactDescriptor.value)) {
      return false;
    }
  }

  try {
    const catalog = value as ArtifactCatalog;
    // The dedicated identity validator preserves the exact Catalog only when no
    // duplicate local ID makes result references ambiguous.
    return validateArtifactCatalogIds(catalog).value === catalog;
  } catch {
    // Stateful Proxy changes after descriptor capture fail closed.
    return false;
  }
}

/** Validates exact absence or one complete reported model descriptor. */
function isOptionalModelDescriptor(descriptor: PropertyDescriptor | undefined): boolean {
  return (
    descriptor === undefined ||
    (isDataDescriptor(descriptor) && isModelDescriptor(descriptor.value))
  );
}

/** Validates exact absence or one open protocol-reported identity. */
function isOptionalOpenIdentifier(descriptor: PropertyDescriptor | undefined): boolean {
  return (
    descriptor === undefined || (isDataDescriptor(descriptor) && isOpenIdentifier(descriptor.value))
  );
}

/** Validates exact absence or one token-usage fact collection. */
function isOptionalTokenUsage(descriptor: PropertyDescriptor | undefined): boolean {
  if (descriptor === undefined) {
    return true;
  }
  if (!isDataDescriptor(descriptor)) {
    return false;
  }

  const descriptors = getRecordDescriptors(descriptor.value);
  const extensionsDescriptor = descriptors?.extensions;
  return (
    descriptors !== undefined &&
    isOptionalTokenCount(descriptors.inputTokens) &&
    isOptionalTokenCount(descriptors.outputTokens) &&
    isOptionalTokenCount(descriptors.totalTokens) &&
    isDataDescriptor(extensionsDescriptor) &&
    isJsonRecord(extensionsDescriptor.value, new Set<object>())
  );
}

/** Validates an optional non-negative exactly represented token count. */
function isOptionalTokenCount(descriptor: PropertyDescriptor | undefined): boolean {
  if (descriptor === undefined) {
    return true;
  }

  // Zero is a valid reported count. Safe-integer and canonical-zero rules reject
  // fractions, non-finite values, overflow, negatives, and JSON-lossy -0.
  return (
    isDataDescriptor(descriptor) &&
    Number.isSafeInteger(descriptor.value) &&
    descriptor.value >= 0 &&
    !Object.is(descriptor.value, -0)
  );
}

/** Validates the ordered collection of opaque protocol-state facts. */
function isProtocolStateArray(value: unknown): value is readonly ProtocolState[] {
  const stateDescriptors = getDenseArrayDescriptors(value);
  if (stateDescriptors === undefined) {
    return false;
  }

  for (const stateDescriptor of stateDescriptors) {
    // State order is significant and each value is checked in descriptor order
    // without invoking indexed accessors or sorting the source array.
    if (!isProtocolState(stateDescriptor.value)) {
      return false;
    }
  }
  return true;
}

/** Validates one protocol-state identity tuple and opaque portable JSON value. */
function isProtocolState(value: unknown): value is ProtocolState {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return false;
  }

  const serviceIdDescriptor = descriptors.serviceId;
  const protocolIdDescriptor = descriptors.protocolId;
  const stateTypeDescriptor = descriptors.stateType;
  const stateValueDescriptor = descriptors.stateValue;
  return (
    isDataDescriptor(serviceIdDescriptor) &&
    isOpenIdentifier(serviceIdDescriptor.value) &&
    isDataDescriptor(protocolIdDescriptor) &&
    isOpenIdentifier(protocolIdDescriptor.value) &&
    isDataDescriptor(stateTypeDescriptor) &&
    isOpenIdentifier(stateTypeDescriptor.value) &&
    isDataDescriptor(stateValueDescriptor) &&
    isPortableJsonValue(stateValueDescriptor.value)
  );
}

/** Validates one arbitrary JsonValue through the shared recursive record rule. */
function isPortableJsonValue(value: unknown): boolean {
  // Wrapping the candidate as one ordinary data property reuses the canonical
  // recursive JsonValue grammar for primitives, arrays, records, and cycles.
  return isJsonRecord({ value }, new Set<object>());
}
