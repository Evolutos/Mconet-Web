// Copyright © 2026 Mcont.

import type { MessageElementBase } from "./message-element-base.js";
import {
  getDenseArrayDescriptors,
  getRecordDescriptors,
  isDataDescriptor,
  isMessageRelationArray,
  type MessageEntry,
} from "./message-entry.js";
import { isJsonRecord } from "./model-descriptor.js";
import { isOpenIdentifier, type OpenIdentifier } from "./open-identifier.js";

/**
 * Immutable container in the ordered Message tree.
 *
 * A group may contain nested groups and leaf entries, but never MessageContent
 * directly. The explicit container composition distinguishes tree structure
 * from entry content while the open kind preserves standard, integration-defined,
 * and future grouping semantics. Local and document validators separately own
 * direct-child identity rules and whole-tree uniqueness or cycle policy.
 */
export interface MessageGroup extends MessageElementBase {
  /** Standard or integration-defined container classification. */
  readonly kind: "message.root" | "message.group" | (OpenIdentifier & Record<never, never>);

  /** Fixed structural role distinguishing this element as a container. */
  readonly composition: "container";

  /** Ordered nested groups and leaf message entries. */
  readonly children: readonly (MessageGroup | MessageEntry)[];
}

/**
 * Determines whether an unknown value satisfies the local group-container contract.
 *
 * This boundary validates the current group and direct child identities without
 * recursively validating child payloads. Whole-document traversal later owns
 * global identity uniqueness, cycle detection, and relation endpoint resolution.
 *
 * @param value Untrusted value to validate.
 * @returns Whether the value is a valid local {@link MessageGroup} container.
 */
export function isMessageGroup(value: unknown): value is MessageGroup {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return false;
  }

  const idDescriptor = descriptors.id;
  const kindDescriptor = descriptors.kind;
  const compositionDescriptor = descriptors.composition;
  const childrenDescriptor = descriptors.children;
  const relationsDescriptor = descriptors.relations;
  const metadataDescriptor = descriptors.metadata;
  const extensionsDescriptor = descriptors.extensions;

  // A group is exclusively a container: role and content are reserved for leaf
  // entries and therefore cannot coexist with the children collection.
  if (
    descriptors.role !== undefined ||
    descriptors.content !== undefined ||
    !isDataDescriptor(idDescriptor) ||
    !isOpenIdentifier(idDescriptor.value) ||
    !isDataDescriptor(kindDescriptor) ||
    !isOpenIdentifier(kindDescriptor.value) ||
    kindDescriptor.value === "message.entry" ||
    !isDataDescriptor(compositionDescriptor) ||
    compositionDescriptor.value !== "container" ||
    !isDataDescriptor(childrenDescriptor) ||
    !hasValidDirectChildren(childrenDescriptor.value, idDescriptor.value) ||
    !isDataDescriptor(relationsDescriptor) ||
    !isMessageRelationArray(relationsDescriptor.value) ||
    !isDataDescriptor(metadataDescriptor) ||
    !isJsonRecord(metadataDescriptor.value, new Set<object>()) ||
    !isDataDescriptor(extensionsDescriptor) ||
    !isJsonRecord(extensionsDescriptor.value, new Set<object>())
  ) {
    return false;
  }

  return true;
}

/** Validates direct element shapes and sibling-local identity rules. */
function hasValidDirectChildren(value: unknown, groupId: string): boolean {
  const childDescriptors = getDenseArrayDescriptors(value);
  if (childDescriptors === undefined) {
    return false;
  }

  const childIds = new Set<string>();
  for (const childDescriptor of childDescriptors) {
    const child = getDirectChildIdentity(childDescriptor.value);
    // Parent collisions and duplicate siblings are already invalid at this local
    // edge, while duplicate IDs in other branches need document traversal.
    if (child === undefined || child.id === groupId || childIds.has(child.id)) {
      return false;
    }
    childIds.add(child.id);
  }
  return true;
}

/** Extracts a shallow identity from an Entry or nested Group child. */
function getDirectChildIdentity(value: unknown): { readonly id: string } | undefined {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return undefined;
  }

  const idDescriptor = descriptors.id;
  const kindDescriptor = descriptors.kind;
  if (
    !isDataDescriptor(idDescriptor) ||
    !isOpenIdentifier(idDescriptor.value) ||
    !isDataDescriptor(kindDescriptor) ||
    !isOpenIdentifier(kindDescriptor.value)
  ) {
    return undefined;
  }

  if (kindDescriptor.value === "message.entry") {
    // Entry payload semantics deliberately remain with isMessageEntry and the
    // later document traversal; this boundary only requires its complete field
    // surface and excludes the reserved container field.
    return descriptors.children === undefined &&
      isDataDescriptor(descriptors.role) &&
      isDataDescriptor(descriptors.content) &&
      isDataDescriptor(descriptors.relations) &&
      isDataDescriptor(descriptors.metadata) &&
      isDataDescriptor(descriptors.extensions)
      ? { id: idDescriptor.value }
      : undefined;
  }

  const compositionDescriptor = descriptors.composition;
  const childrenDescriptor = descriptors.children;
  // A non-entry child must expose the minimum container surface. Its descendants
  // are not traversed during this local validation step.
  return isDataDescriptor(compositionDescriptor) &&
    compositionDescriptor.value === "container" &&
    isDataDescriptor(childrenDescriptor) &&
    getDenseArrayDescriptors(childrenDescriptor.value) !== undefined &&
    isDataDescriptor(descriptors.relations) &&
    isDataDescriptor(descriptors.metadata) &&
    isDataDescriptor(descriptors.extensions)
    ? { id: idDescriptor.value }
    : undefined;
}
