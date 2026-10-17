// Copyright © 2026 Mcont.

import type { ConversationInputNode } from "./conversation-input-node.js";
import type { GenerationParametersNode } from "./generation-parameters-node.js";
import type { GenerationParameters } from "./generation-parameters.js";
import {
  getDenseArrayDescriptors,
  getRecordDescriptors,
  isDataDescriptor,
} from "./message-entry.js";
import { isMessageDocument } from "./message-document.js";
import { isJsonRecord } from "./model-descriptor.js";
import { isOpenIdentifier } from "./open-identifier.js";
import type { RawPayload } from "./raw-payload.js";
import type { TaskGroupNode } from "./task-group-node.js";
import type { TaskRelation } from "./task-relation.js";
import { isAbsentOrToolDeclarations } from "./tool-call.js";
import type { UnknownTaskNode } from "./unknown-task-node.js";

/**
 * Immutable Task-document node variants currently defined by core-domain.
 *
 * Container composition identifies TaskGroupNode. ConversationInputNode and
 * GenerationParametersNode are typed leaves carrying their complete domain
 * values, while UnknownTaskNode preserves every other current leaf kind. The
 * union contains no Message element directly, Artifact, protocol value, model
 * selection, access data, or runtime behavior.
 */
export type TaskNode =
  TaskGroupNode | ConversationInputNode | GenerationParametersNode | UnknownTaskNode;

/**
 * Determines whether an unknown value satisfies one local Task-node contract.
 *
 * The current node and direct child surfaces are validated without recursively
 * validating child payloads. Whole-tree identity uniqueness, relation endpoint
 * resolution, cycle detection, and descendant semantics belong to the enclosing
 * TaskDocument validator. Generation parameter ranges remain dedicated validator
 * work; this boundary establishes only their runtime storage shape.
 *
 * @param value Untrusted value to validate.
 * @returns Whether the value is a valid local {@link TaskNode}.
 */
export function isTaskNode(value: unknown): value is TaskNode {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return false;
  }

  const idDescriptor = descriptors.id;
  const kindDescriptor = descriptors.kind;
  const compositionDescriptor = descriptors.composition;
  const relationsDescriptor = descriptors.relations;
  const metadataDescriptor = descriptors.metadata;
  const extensionsDescriptor = descriptors.extensions;

  // Every shared field must use own data storage. JSON fields are validated as
  // independent trees so safe shared subobjects do not appear cyclic.
  if (
    !isDataDescriptor(idDescriptor) ||
    !isNonblankString(idDescriptor.value) ||
    !isDataDescriptor(kindDescriptor) ||
    !isOpenIdentifier(kindDescriptor.value) ||
    !isDataDescriptor(compositionDescriptor) ||
    !isDataDescriptor(relationsDescriptor) ||
    !isTaskRelationArray(relationsDescriptor.value) ||
    !isDataDescriptor(metadataDescriptor) ||
    !isJsonRecord(metadataDescriptor.value, new Set<object>()) ||
    !isDataDescriptor(extensionsDescriptor) ||
    !isJsonRecord(extensionsDescriptor.value, new Set<object>())
  ) {
    return false;
  }

  // Composition is the authoritative structural discriminator. Known leaf
  // payloads are selected separately by Kind and cannot become containers.
  if (compositionDescriptor.value === "container") {
    return isContainerNode(descriptors, idDescriptor.value, kindDescriptor.value);
  }
  if (compositionDescriptor.value === "leaf") {
    return isLeafNode(descriptors, kindDescriptor.value);
  }
  return false;
}

/** Validates the container-only fields and direct child identity set. */
function isContainerNode(
  descriptors: Record<string, PropertyDescriptor>,
  nodeId: string,
  kind: string,
): boolean {
  const childrenDescriptor = descriptors.children;

  // Standard typed-leaf Kinds cannot be reclassified as containers. Payload
  // fields are reserved for leaves and must not coexist with ordered children.
  return (
    kind !== "task.input.conversation" &&
    kind !== "task.configuration" &&
    descriptors.messages === undefined &&
    descriptors.parameters === undefined &&
    descriptors.raw === undefined &&
    isDataDescriptor(childrenDescriptor) &&
    hasValidDirectChildren(childrenDescriptor.value, nodeId)
  );
}

/** Validates one leaf variant without interpreting unknown top-level fields. */
function isLeafNode(descriptors: Record<string, PropertyDescriptor>, kind: string): boolean {
  // A leaf has no child collection. Known Kinds require exactly their typed
  // payload channel, while every other open Kind uses unknown-node preservation.
  if (descriptors.children !== undefined) {
    return false;
  }

  if (kind === "task.input.conversation") {
    // Tools are optional on a conversation input. A present list must be a
    // non-empty set of distinct function declarations.
    return (
      descriptors.parameters === undefined &&
      descriptors.raw === undefined &&
      isDataDescriptor(descriptors.messages) &&
      isMessageDocument(descriptors.messages.value) &&
      isAbsentOrToolDeclarations(descriptors.tools)
    );
  }

  if (kind === "task.configuration") {
    return (
      descriptors.messages === undefined &&
      descriptors.raw === undefined &&
      isDataDescriptor(descriptors.parameters) &&
      isGenerationParametersShape(descriptors.parameters.value)
    );
  }

  const rawDescriptor = descriptors.raw;
  return (
    descriptors.messages === undefined &&
    descriptors.parameters === undefined &&
    (rawDescriptor === undefined ||
      (isDataDescriptor(rawDescriptor) && isRawPayloadShape(rawDescriptor.value)))
  );
}

/** Validates direct child surfaces and parent/sibling-local identity rules. */
function hasValidDirectChildren(value: unknown, parentId: string): boolean {
  const childDescriptors = getDenseArrayDescriptors(value);
  if (childDescriptors === undefined) {
    return false;
  }

  const childIds = new Set<string>();
  for (const childDescriptor of childDescriptors) {
    const child = getDirectChildIdentity(childDescriptor.value);
    // Global duplicate detection requires document traversal, but collisions on
    // this immediate edge can be rejected without inspecting child semantics.
    if (child === undefined || child.id === parentId || childIds.has(child.id)) {
      return false;
    }
    childIds.add(child.id);
  }
  return true;
}

/** Extracts one shallow identity from a structurally complete direct child. */
function getDirectChildIdentity(value: unknown): { readonly id: string } | undefined {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return undefined;
  }

  const idDescriptor = descriptors.id;
  const kindDescriptor = descriptors.kind;
  const compositionDescriptor = descriptors.composition;
  if (
    !isDataDescriptor(idDescriptor) ||
    !isNonblankString(idDescriptor.value) ||
    !isDataDescriptor(kindDescriptor) ||
    !isOpenIdentifier(kindDescriptor.value) ||
    !isDataDescriptor(compositionDescriptor) ||
    !hasSharedChildStorage(descriptors)
  ) {
    return undefined;
  }

  if (compositionDescriptor.value === "container") {
    // Direct validation confirms only the recursive collection's dense storage;
    // the child itself is validated when TaskDocument later visits it.
    return kindDescriptor.value !== "task.input.conversation" &&
      kindDescriptor.value !== "task.configuration" &&
      descriptors.messages === undefined &&
      descriptors.parameters === undefined &&
      descriptors.raw === undefined &&
      isDataDescriptor(descriptors.children) &&
      getDenseArrayDescriptors(descriptors.children.value) !== undefined
      ? { id: idDescriptor.value }
      : undefined;
  }

  if (compositionDescriptor.value !== "leaf" || descriptors.children !== undefined) {
    return undefined;
  }

  // A known Kind needs its corresponding payload field to establish the direct
  // child surface; nested payload semantics remain deferred to child visitation.
  if (kindDescriptor.value === "task.input.conversation") {
    return descriptors.parameters === undefined &&
      descriptors.raw === undefined &&
      isDataDescriptor(descriptors.messages)
      ? { id: idDescriptor.value }
      : undefined;
  }
  if (kindDescriptor.value === "task.configuration") {
    return descriptors.messages === undefined &&
      descriptors.raw === undefined &&
      isDataDescriptor(descriptors.parameters)
      ? { id: idDescriptor.value }
      : undefined;
  }
  return descriptors.messages === undefined &&
    descriptors.parameters === undefined &&
    (descriptors.raw === undefined || isDataDescriptor(descriptors.raw))
    ? { id: idDescriptor.value }
    : undefined;
}

/** Checks the shared stored fields required on every direct Task child. */
function hasSharedChildStorage(descriptors: Record<string, PropertyDescriptor>): boolean {
  // Child payloads are intentionally not read here, but the later traversal must
  // be able to validate relations and preservation maps from own data properties.
  return (
    isDataDescriptor(descriptors.relations) &&
    isDataDescriptor(descriptors.metadata) &&
    isDataDescriptor(descriptors.extensions)
  );
}

/** Validates an ordered dense array of local Task relations. */
function isTaskRelationArray(value: unknown): value is readonly TaskRelation[] {
  const relationDescriptors = getDenseArrayDescriptors(value);
  if (relationDescriptors === undefined) {
    return false;
  }

  for (const relationDescriptor of relationDescriptors) {
    // Iterate numeric data descriptors in caller order without executing array
    // accessors, sorting relations, or resolving document-local endpoints.
    if (!isTaskRelationShape(relationDescriptor.value)) {
      return false;
    }
  }
  return true;
}

/** Validates one relation shape without resolving its endpoints. */
function isTaskRelationShape(value: unknown): value is TaskRelation {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return false;
  }

  const sourceIdDescriptor = descriptors.sourceId;
  const targetIdDescriptor = descriptors.targetId;
  const typeDescriptor = descriptors.type;
  const metadataDescriptor = descriptors.metadata;
  // Endpoint existence and self-reference policy require a complete document
  // index; local validation establishes only usable IDs, type, and JSON data.
  return (
    isDataDescriptor(sourceIdDescriptor) &&
    isNonblankString(sourceIdDescriptor.value) &&
    isDataDescriptor(targetIdDescriptor) &&
    isNonblankString(targetIdDescriptor.value) &&
    isDataDescriptor(typeDescriptor) &&
    isOpenIdentifier(typeDescriptor.value) &&
    isDataDescriptor(metadataDescriptor) &&
    isJsonRecord(metadataDescriptor.value, new Set<object>())
  );
}

/** Validates GenerationParameters storage without applying semantic ranges. */
function isGenerationParametersShape(value: unknown): value is GenerationParameters {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return false;
  }

  // All fields are independently optional. Present values must use exact data
  // storage and declared primitive/collection types; NaN and ranges remain for
  // the later dedicated semantic validator.
  return (
    isOptionalNumberDescriptor(descriptors.temperature) &&
    isOptionalNumberDescriptor(descriptors.topP) &&
    isOptionalNumberDescriptor(descriptors.maxOutputTokens) &&
    isOptionalStringArrayDescriptor(descriptors.stop) &&
    isOptionalNumberDescriptor(descriptors.seed)
  );
}

/** Validates the optional RawPayload storage of an unknown leaf. */
function isRawPayloadShape(value: unknown): value is RawPayload {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return false;
  }

  const bytesDescriptor = descriptors.bytes;
  const truncatedDescriptor = descriptors.truncated;
  const metadataDescriptor = descriptors.metadata;
  try {
    // Byte identity remains a Uint8Array view. This validator neither reads nor
    // copies bytes and applies no size policy to preserved unknown payloads.
    return (
      isOptionalStringDescriptor(descriptors.mediaType) &&
      isOptionalStringDescriptor(descriptors.schemaId) &&
      isDataDescriptor(bytesDescriptor) &&
      bytesDescriptor.value instanceof Uint8Array &&
      isDataDescriptor(truncatedDescriptor) &&
      typeof truncatedDescriptor.value === "boolean" &&
      isDataDescriptor(metadataDescriptor) &&
      isJsonRecord(metadataDescriptor.value, new Set<object>())
    );
  } catch {
    // Hostile byte or metadata values fail closed instead of escaping through
    // instanceof or recursive JSON inspection.
    return false;
  }
}

/** Checks an optional own numeric data property. */
function isOptionalNumberDescriptor(descriptor: PropertyDescriptor | undefined): boolean {
  // True absence is valid; explicit undefined and coercible strings are not.
  return (
    descriptor === undefined ||
    (isDataDescriptor(descriptor) && typeof descriptor.value === "number")
  );
}

/** Checks an optional dense array containing only stored string values. */
function isOptionalStringArrayDescriptor(descriptor: PropertyDescriptor | undefined): boolean {
  if (descriptor === undefined) {
    return true;
  }
  if (!isDataDescriptor(descriptor)) {
    return false;
  }

  const valueDescriptors = getDenseArrayDescriptors(descriptor.value);
  if (valueDescriptors === undefined) {
    return false;
  }

  for (const valueDescriptor of valueDescriptors) {
    // Read only captured numeric data descriptors. Accessors, sparse membership,
    // symbols, and subclassed arrays already failed during descriptor capture.
    if (typeof valueDescriptor.value !== "string") {
      return false;
    }
  }
  return true;
}

/** Checks an optional own opaque string data property. */
function isOptionalStringDescriptor(descriptor: PropertyDescriptor | undefined): boolean {
  // Optional wire labels remain opaque; this boundary validates storage only.
  return (
    descriptor === undefined ||
    (isDataDescriptor(descriptor) && typeof descriptor.value === "string")
  );
}

/** Checks that a document-local opaque ID contains visible content. */
function isNonblankString(value: unknown): value is string {
  // IDs remain case-sensitive and unnormalized; trimming detects blank-only
  // values without replacing the caller's original spelling.
  return typeof value === "string" && value.trim().length > 0;
}
