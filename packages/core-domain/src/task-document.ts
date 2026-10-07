// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import {
  getDenseArrayDescriptors,
  getRecordDescriptors,
  isDataDescriptor,
} from "./message-entry.js";
import { isJsonRecord } from "./model-descriptor.js";
import type { TaskGroupNode } from "./task-group-node.js";
import { isTaskNode } from "./task-node.js";

/**
 * Immutable versioned envelope for one Task-domain tree.
 *
 * The root is always a TaskGroupNode so a leaf cannot replace the document
 * container. Version, metadata, and extensions remain portable descriptive data.
 * This envelope contains no Message root, ArtifactCatalog, model target, service
 * access, protocol payload, validation, traversal, or execution behavior.
 */
export interface TaskDocument {
  /** Opaque Task-document schema version interpreted by later boundaries. */
  readonly version: string;

  /** Required container at the root of the ordered Task tree. */
  readonly root: TaskGroupNode;

  /** Always-present JSON-compatible document metadata. */
  readonly metadata: Readonly<Record<string, JsonValue>>;

  /** Always-present namespaced extensions for forward-compatible Task data. */
  readonly extensions: Extensions;
}

/** Relation endpoints retained until the complete Task-node index is available. */
interface PendingTaskRelation {
  readonly sourceId: string;
  readonly targetId: string;
}

/** Enter/leave frame used for iterative traversal and active-path tracking. */
interface TaskTraversalFrame {
  readonly value: unknown;
  readonly leaving: boolean;
}

/** Stable current-node data captured for one whole-tree traversal step. */
interface InspectedTaskNode {
  readonly id: string;
  readonly kind: string;
  readonly composition: "leaf" | "container";
  readonly children: readonly unknown[];
  readonly relations: readonly PendingTaskRelation[];
}

/**
 * Determines whether an unknown value is a complete valid Task document.
 *
 * Traversal is iterative, all node IDs share one document-local namespace, and
 * relations resolve only after the complete index exists. The root has the exact
 * `task.root` container identity. Input objects and collection order are observed
 * without rebuilding, sorting, normalization, or recursive call-stack growth.
 *
 * @param value Untrusted value to validate.
 * @returns Whether the value satisfies the complete {@link TaskDocument} contract.
 */
export function isTaskDocument(value: unknown): value is TaskDocument {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return false;
  }

  const versionDescriptor = descriptors.version;
  const rootDescriptor = descriptors.root;
  const metadataDescriptor = descriptors.metadata;
  const extensionsDescriptor = descriptors.extensions;

  // Envelope fields must be own stored values. Version remains opaque but must
  // identify some format, while both preservation maps use strict portable JSON.
  if (
    !isDataDescriptor(versionDescriptor) ||
    !isNonblankString(versionDescriptor.value) ||
    !isDataDescriptor(rootDescriptor) ||
    !isDataDescriptor(metadataDescriptor) ||
    !isJsonRecord(metadataDescriptor.value, new Set<object>()) ||
    !isDataDescriptor(extensionsDescriptor) ||
    !isJsonRecord(extensionsDescriptor.value, new Set<object>())
  ) {
    return false;
  }

  return isValidTaskTree(rootDescriptor.value);
}

/** Validates the complete Task tree, global IDs, cycles, and relation endpoints. */
function isValidTaskTree(root: unknown): boolean {
  const nodeIds = new Set<string>();
  const relations: PendingTaskRelation[] = [];
  const activeObjects = new Set<object>();
  const pending: TaskTraversalFrame[] = [{ value: root, leaving: false }];
  let isFirstNode = true;

  while (pending.length > 0) {
    const frame = pending.pop();
    // Length was checked before pop, but the guard keeps narrowing independent
    // from mutable Array.pop typing and rejects primitive traversal entries.
    if (frame === undefined || typeof frame.value !== "object" || frame.value === null) {
      return false;
    }

    if (frame.leaving) {
      // Leave frames clear only the current ancestry path. Reusing an object in
      // another branch then reaches the global duplicate-ID rule normally.
      activeObjects.delete(frame.value);
      continue;
    }
    if (activeObjects.has(frame.value)) {
      return false;
    }

    const node = inspectTaskNode(frame.value);
    if (node === undefined || nodeIds.has(node.id)) {
      return false;
    }

    // Only the document entry point has a fixed semantic identity. Descendant
    // containers retain open Kinds for integration and future task structures.
    if (isFirstNode && (node.kind !== "task.root" || node.composition !== "container")) {
      return false;
    }
    isFirstNode = false;

    activeObjects.add(frame.value);
    nodeIds.add(node.id);
    pending.push({ value: frame.value, leaving: true });
    for (const relation of node.relations) {
      // Append individually so a large untrusted relation list cannot exceed the
      // engine's function-argument limit through Array.push spread.
      relations.push(relation);
    }

    // Push children in reverse so the effective validation order preserves the
    // producer's declared left-to-right preorder without mutating the array.
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      pending.push({ value: node.children[index], leaving: false });
    }
  }

  // Resolve after indexing every node so forward and self references are valid,
  // while neither endpoint can escape to another request or document scope.
  for (const relation of relations) {
    if (!nodeIds.has(relation.sourceId) || !nodeIds.has(relation.targetId)) {
      return false;
    }
  }
  return true;
}

/** Validates and snapshots one current node without recursively visiting children. */
function inspectTaskNode(value: object): InspectedTaskNode | undefined {
  if (!isTaskNode(value)) {
    return undefined;
  }

  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return undefined;
  }

  const idDescriptor = descriptors.id;
  const kindDescriptor = descriptors.kind;
  const compositionDescriptor = descriptors.composition;
  const relationsDescriptor = descriptors.relations;
  if (
    !isDataDescriptor(idDescriptor) ||
    !isNonblankString(idDescriptor.value) ||
    !isDataDescriptor(kindDescriptor) ||
    typeof kindDescriptor.value !== "string" ||
    !isDataDescriptor(compositionDescriptor) ||
    (compositionDescriptor.value !== "leaf" && compositionDescriptor.value !== "container") ||
    !isDataDescriptor(relationsDescriptor)
  ) {
    // A mutable or hostile object changed after local validation and can no
    // longer supply the stable traversal snapshot required by this document.
    return undefined;
  }

  const relations = snapshotRelations(relationsDescriptor.value);
  if (relations === undefined) {
    return undefined;
  }

  let children: readonly unknown[] = [];
  if (compositionDescriptor.value === "container") {
    const childrenDescriptor = descriptors.children;
    if (!isDataDescriptor(childrenDescriptor)) {
      return undefined;
    }
    const childDescriptors = getDenseArrayDescriptors(childrenDescriptor.value);
    if (childDescriptors === undefined) {
      return undefined;
    }

    const snapshot: unknown[] = [];
    for (const childDescriptor of childDescriptors) {
      // Capture each stored child reference exactly once; descendant validation
      // occurs later when its enter frame becomes current.
      snapshot.push(childDescriptor.value);
    }
    children = snapshot;
  }

  return {
    id: idDescriptor.value,
    kind: kindDescriptor.value,
    composition: compositionDescriptor.value,
    children,
    relations,
  };
}

/** Captures already locally validated relation endpoints in declared order. */
function snapshotRelations(value: unknown): readonly PendingTaskRelation[] | undefined {
  const relationDescriptors = getDenseArrayDescriptors(value);
  if (relationDescriptors === undefined) {
    return undefined;
  }

  const relations: PendingTaskRelation[] = [];
  for (const relationDescriptor of relationDescriptors) {
    const descriptors = getRecordDescriptors(relationDescriptor.value);
    const sourceIdDescriptor = descriptors?.sourceId;
    const targetIdDescriptor = descriptors?.targetId;
    if (
      !isDataDescriptor(sourceIdDescriptor) ||
      !isNonblankString(sourceIdDescriptor.value) ||
      !isDataDescriptor(targetIdDescriptor) ||
      !isNonblankString(targetIdDescriptor.value)
    ) {
      // A mutable relation changed after local node validation and cannot enter
      // the document's stable endpoint-resolution snapshot.
      return undefined;
    }
    relations.push({
      sourceId: sourceIdDescriptor.value,
      targetId: targetIdDescriptor.value,
    });
  }
  return relations;
}

/** Checks that an opaque version or node ID contains visible content. */
function isNonblankString(value: unknown): value is string {
  // Values remain case-sensitive and unnormalized; trimming is used only to
  // detect empty or whitespace-only content.
  return typeof value === "string" && value.trim().length > 0;
}
