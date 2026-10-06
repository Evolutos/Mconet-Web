// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import {
  getDenseArrayDescriptors,
  getRecordDescriptors,
  isDataDescriptor,
  type MessageEntry,
} from "./message-entry.js";
import { isMessageEntry } from "./message-entry.js";
import { isMessageGroup, type MessageGroup } from "./message-group.js";
import { isJsonRecord } from "./model-descriptor.js";
import { isOpenIdentifier, type OpenIdentifier } from "./open-identifier.js";

/**
 * Immutable, versioned root envelope for one Message-domain tree.
 *
 * Purpose describes input, output, context, or an integration-defined use. The
 * root is always a MessageGroup so a document cannot replace its container with
 * a leaf entry. This neutral envelope contains no task parameters, model target,
 * service access, authorization, protocol payload, or execution behavior.
 */
export interface MessageDocument {
  /** Message schema version interpreted by validators and mappers. */
  readonly version: string;

  /** Standard or integration-defined reason this document exists. */
  readonly purpose: "input" | "output" | "context" | (OpenIdentifier & Record<never, never>);

  /** Required container at the root of the ordered Message tree. */
  readonly root: MessageGroup;

  /** Always-present JSON-compatible document metadata. */
  readonly metadata: Readonly<Record<string, JsonValue>>;

  /** Always-present namespaced extensions for forward-compatible data. */
  readonly extensions: Extensions;
}

/** Relation endpoints retained until the complete element index is available. */
interface PendingRelation {
  readonly sourceId: string;
  readonly targetId: string;
}

/** Enter/leave frame used for iterative tree traversal and active-path tracking. */
interface TraversalFrame {
  readonly value: unknown;
  readonly leaving: boolean;
}

/**
 * Determines whether an unknown value is a complete valid message document.
 *
 * Traversal is iterative, all element and content IDs share one document-local
 * namespace, and relations resolve only to element IDs after the full index has
 * been built. The input is observed without rebuilding, sorting, or normalization.
 *
 * @param value Untrusted value to validate.
 * @returns Whether the value satisfies the complete {@link MessageDocument} contract.
 */
export function isMessageDocument(value: unknown): value is MessageDocument {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return false;
  }

  const versionDescriptor = descriptors.version;
  const purposeDescriptor = descriptors.purpose;
  const rootDescriptor = descriptors.root;
  const metadataDescriptor = descriptors.metadata;
  const extensionsDescriptor = descriptors.extensions;
  if (
    !isDataDescriptor(versionDescriptor) ||
    typeof versionDescriptor.value !== "string" ||
    isBlank(versionDescriptor.value) ||
    !isDataDescriptor(purposeDescriptor) ||
    !isOpenIdentifier(purposeDescriptor.value) ||
    !isDataDescriptor(rootDescriptor) ||
    !hasRootKind(rootDescriptor.value) ||
    !isDataDescriptor(metadataDescriptor) ||
    !isJsonRecord(metadataDescriptor.value, new Set<object>()) ||
    !isDataDescriptor(extensionsDescriptor) ||
    !isJsonRecord(extensionsDescriptor.value, new Set<object>())
  ) {
    return false;
  }

  // Whole-tree invariants require the complete traversal and cannot be inferred
  // from the root group's local validator alone.
  return isValidDocumentTree(rootDescriptor.value);
}

/** Checks that the root is a valid group with the exact standard root kind. */
function hasRootKind(value: unknown): value is MessageGroup {
  const descriptors = getRecordDescriptors(value);
  const kindDescriptor = descriptors?.kind;
  // Validate the exact discriminator before traversing so an ordinary group
  // cannot silently become the document anchor.
  return (
    isDataDescriptor(kindDescriptor) &&
    kindDescriptor.value === "message.root" &&
    isMessageGroup(value)
  );
}

/** Validates the complete tree, shared ID namespace, cycles, and relations. */
function isValidDocumentTree(root: MessageGroup): boolean {
  const elementIds = new Set<string>();
  const allIds = new Set<string>();
  const relations: PendingRelation[] = [];
  const activeObjects = new Set<object>();
  const pending: TraversalFrame[] = [{ value: root, leaving: false }];

  while (pending.length > 0) {
    const frame = pending.pop();
    // Length was checked before pop, but retaining the guard keeps the local
    // narrowing independent from mutable Array.pop typing.
    if (frame === undefined || typeof frame.value !== "object" || frame.value === null) {
      return false;
    }

    if (frame.leaving) {
      // Leave frames remove only the current traversal path; a reused object in
      // another branch then reaches the global duplicate-ID check normally.
      activeObjects.delete(frame.value);
      continue;
    }
    if (activeObjects.has(frame.value)) {
      return false;
    }

    const element = inspectElement(frame.value);
    if (element === undefined || !registerId(element.id, allIds)) {
      return false;
    }

    activeObjects.add(frame.value);
    elementIds.add(element.id);
    for (const relation of element.relations) {
      // Append individually so an untrusted document with many relations cannot
      // exceed the engine's function-argument limit through Array.push spread.
      relations.push(relation);
    }
    pending.push({ value: frame.value, leaving: true });

    if (element.entry !== undefined && !registerContentIds(element.entry, allIds)) {
      return false;
    }

    // Push children in reverse so the effective validation order remains the
    // caller's declared preorder without modifying the original array.
    for (let index = element.children.length - 1; index >= 0; index -= 1) {
      const child = element.children[index];
      if (child === undefined) {
        return false;
      }
      pending.push({ value: child.value, leaving: false });
    }
  }

  // Resolve after indexing every element so forward references are independent
  // from traversal order and content IDs can never serve as relation endpoints.
  for (const { sourceId, targetId } of relations) {
    // Both explicit endpoints must name elements; no owner inference or content
    // fallback is permitted for a missing side of the directed relation.
    if (!elementIds.has(sourceId) || !elementIds.has(targetId)) {
      return false;
    }
  }
  return true;
}

/** Snapshot returned after one element's dedicated local validator succeeds. */
interface InspectedElement {
  readonly id: string;
  readonly entry?: MessageEntry;
  readonly children: readonly (PropertyDescriptor & { readonly value: unknown })[];
  readonly relations: readonly PendingRelation[];
}

/** Validates one concrete element and snapshots fields needed by traversal. */
function inspectElement(value: object): InspectedElement | undefined {
  const descriptors = getRecordDescriptors(value);
  const idDescriptor = descriptors?.id;
  const kindDescriptor = descriptors?.kind;
  if (
    descriptors === undefined ||
    !isDataDescriptor(idDescriptor) ||
    !isOpenIdentifier(idDescriptor.value) ||
    !isDataDescriptor(kindDescriptor)
  ) {
    return undefined;
  }

  const relationDescriptors = getDenseArrayDescriptors(descriptors.relations?.value);
  const relations = relationDescriptors && snapshotRelations(relationDescriptors);
  if (relations === undefined) {
    return undefined;
  }

  if (kindDescriptor.value === "message.entry") {
    // Entry validation owns role, content, leaf, relation, and JSON invariants.
    return isMessageEntry(value)
      ? { id: idDescriptor.value, entry: value, children: [], relations }
      : undefined;
  }

  const childDescriptors = getDenseArrayDescriptors(descriptors.children?.value);
  // Every non-entry tree node in the current Web representation is a Group;
  // its local validator owns container and direct-child rules.
  return isMessageGroup(value) && childDescriptors !== undefined
    ? { id: idDescriptor.value, children: childDescriptors, relations }
    : undefined;
}

/** Registers all content IDs and rejects element-shaped content values. */
function registerContentIds(entry: MessageEntry, allIds: Set<string>): boolean {
  const entryDescriptors = getRecordDescriptors(entry);
  const contentDescriptors = getDenseArrayDescriptors(entryDescriptors?.content?.value);
  if (contentDescriptors === undefined) {
    return false;
  }

  for (const contentDescriptor of contentDescriptors) {
    const content = getRecordDescriptors(contentDescriptor.value);
    const idDescriptor = content?.id;
    // Element-only fields preserve the MessageElement/MessageContent domain
    // boundary even when a structural object otherwise resembles open content.
    if (
      content === undefined ||
      content.composition !== undefined ||
      content.children !== undefined ||
      content.role !== undefined ||
      content.content !== undefined ||
      !isDataDescriptor(idDescriptor) ||
      !registerId(idDescriptor.value, allIds)
    ) {
      return false;
    }
  }
  return true;
}

/** Snapshots already shape-validated relations for document-wide resolution. */
function snapshotRelations(
  descriptors: readonly (PropertyDescriptor & { readonly value: unknown })[],
): readonly PendingRelation[] | undefined {
  const relations: PendingRelation[] = [];
  for (const descriptor of descriptors) {
    const relation = getRecordDescriptors(descriptor.value);
    const sourceDescriptor = relation?.sourceId;
    const targetDescriptor = relation?.targetId;
    // Local element validators already check relation syntax; this guarded read
    // retains only endpoints needed by the second document pass.
    if (
      !isDataDescriptor(sourceDescriptor) ||
      typeof sourceDescriptor.value !== "string" ||
      !isDataDescriptor(targetDescriptor) ||
      typeof targetDescriptor.value !== "string"
    ) {
      return undefined;
    }
    relations.push({ sourceId: sourceDescriptor.value, targetId: targetDescriptor.value });
  }
  return relations;
}

/** Registers one identifier in the shared element/content namespace. */
function registerId(value: unknown, allIds: Set<string>): value is string {
  // Reuse the portable open-identifier boundary and keep comparison exact and
  // case-sensitive; no trimming or normalization changes document identity.
  if (!isOpenIdentifier(value) || allIds.has(value)) {
    return false;
  }
  allIds.add(value);
  return true;
}

/** Determines whether a string is empty or consists entirely of whitespace. */
function isBlank(value: string): boolean {
  // Version remains opaque and untrimmed, but cannot be semantically absent.
  return value.length === 0 || /^\s+$/u.test(value);
}
