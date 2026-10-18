// Copyright © 2026 Mcont.

import type { ArtifactCatalog } from "./artifact-catalog.js";
import { isGenerationParameters } from "./generation-parameters.js";
import {
  getDenseArrayDescriptors,
  getRecordDescriptors,
  isDataDescriptor,
} from "./message-entry.js";
import { isMessageDocument } from "./message-document.js";
import type { ModelTaskRequest } from "./model-task-request.js";
import { isJsonRecord } from "./model-descriptor.js";
import { isTaskDescriptor } from "./task-descriptor.js";
import type { TaskDescriptor } from "./task-descriptor.js";
import { isTaskDocument, type TaskDocument } from "./task-document.js";
import { validateImageArtifactSupport } from "./validate-image-artifact-support.js";

/**
 * Immutable model-task request for conversation generation.
 *
 * The descriptor type is fixed independently from the TaskDocument contents.
 * Conversation input and generation settings remain concrete nodes inside the
 * document, while Artifact scope, metadata, and extensions retain the common
 * open request boundaries. Runtime validation below composes their dedicated
 * structural and supported-range predicates without moving Message data here.
 */
export interface ConversationTaskRequest extends ModelTaskRequest {
  /** Fixed conversation-generation descriptor with all shared descriptor data. */
  readonly descriptor: TaskDescriptor & {
    readonly type: "conversation.generate";
  };
}

/**
 * Determines whether an unknown value is a supported conversation Task request.
 *
 * Validation composes the complete descriptor and Task-document boundaries, then
 * applies the current conversation range: at least one input MessageDocument,
 * text or referenced image content, and valid generation settings. Unknown
 * Task-node kinds remain preserved for their later explicit range gate. No
 * defaults, normalization, mapping, I/O, or mutation are performed.
 *
 * @param value Untrusted Task request to validate.
 * @returns Whether the value satisfies the supported {@link ConversationTaskRequest} contract.
 */
export function isConversationTaskRequest(value: unknown): value is ConversationTaskRequest {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return false;
  }

  const descriptorDescriptor = descriptors.descriptor;
  const documentDescriptor = descriptors.document;
  const artifactsDescriptor = descriptors.artifacts;
  const metadataDescriptor = descriptors.metadata;
  const extensionsDescriptor = descriptors.extensions;
  if (
    !isDataDescriptor(descriptorDescriptor) ||
    !hasConversationDescriptor(descriptorDescriptor.value) ||
    !isDataDescriptor(documentDescriptor) ||
    !isTaskDocument(documentDescriptor.value) ||
    !isDataDescriptor(artifactsDescriptor) ||
    !isSupportedArtifactCatalog(artifactsDescriptor.value) ||
    !isDataDescriptor(metadataDescriptor) ||
    !isJsonRecord(metadataDescriptor.value, new Set<object>()) ||
    !isDataDescriptor(extensionsDescriptor) ||
    !isJsonRecord(extensionsDescriptor.value, new Set<object>())
  ) {
    return false;
  }

  // Scope-specific node checks run only after the whole Task tree is valid, so
  // each typed payload may safely delegate to its own complete validator.
  return hasSupportedConversationNodes(
    documentDescriptor.value,
    artifactsDescriptor.value as ArtifactCatalog,
  );
}

/** Validates the open descriptor and its exact conversation Task identity. */
function hasConversationDescriptor(value: unknown): boolean {
  if (!isTaskDescriptor(value)) {
    return false;
  }

  const descriptors = getRecordDescriptors(value);
  const typeDescriptor = descriptors?.type;
  // Reinspect stored type after general validation so a mutable or stateful
  // object cannot change task family between the two decisions.
  return isDataDescriptor(typeDescriptor) && typeDescriptor.value === "conversation.generate";
}

/** Validates a dense Artifact collection. Image support is applied with the messages. */
function isSupportedArtifactCatalog(value: unknown): value is ArtifactCatalog {
  const descriptors = getRecordDescriptors(value);
  const artifactsDescriptor = descriptors?.artifacts;
  if (!isDataDescriptor(artifactsDescriptor)) {
    return false;
  }

  // An empty collection is the text-only scope. A non-empty collection is
  // accepted here and then restricted to referenced images with the messages.
  return getDenseArrayDescriptors(artifactsDescriptor.value) !== undefined;
}

/** Traverses validated Task nodes and applies typed conversation payload ranges. */
function hasSupportedConversationNodes(document: TaskDocument, catalog: ArtifactCatalog): boolean {
  try {
    // Image references are checked against this request's catalog before node
    // payloads are trusted. A hostile proxy read fails closed.
    if (validateImageArtifactSupport(document, catalog).value === undefined) {
      return false;
    }
  } catch {
    return false;
  }

  const documentDescriptors = getRecordDescriptors(document);
  const rootDescriptor = documentDescriptors?.root;
  if (!isDataDescriptor(rootDescriptor)) {
    return false;
  }

  const pending: unknown[] = [rootDescriptor.value];
  const visitedNodes = new Set<object>();
  let conversationInputCount = 0;

  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || visitedNodes.has(value)) {
      // Complete TaskDocument validation already excludes cycles and shared node
      // objects; repeating the guard prevents post-validation mutation loops.
      return false;
    }
    visitedNodes.add(value);

    const descriptors = getRecordDescriptors(value);
    const kindDescriptor = descriptors?.kind;
    const compositionDescriptor = descriptors?.composition;
    if (
      descriptors === undefined ||
      !isDataDescriptor(kindDescriptor) ||
      typeof kindDescriptor.value !== "string" ||
      !isDataDescriptor(compositionDescriptor)
    ) {
      return false;
    }

    if (kindDescriptor.value === "task.input.conversation") {
      if (
        compositionDescriptor.value !== "leaf" ||
        !hasSupportedMessageInput(descriptors.messages)
      ) {
        return false;
      }
      conversationInputCount += 1;
    } else if (kindDescriptor.value === "task.configuration") {
      if (
        compositionDescriptor.value !== "leaf" ||
        !isDataDescriptor(descriptors.parameters) ||
        !isGenerationParameters(descriptors.parameters.value)
      ) {
        return false;
      }
    }

    if (compositionDescriptor.value === "container") {
      const childrenDescriptor = descriptors.children;
      if (!isDataDescriptor(childrenDescriptor)) {
        return false;
      }
      const childDescriptors = getDenseArrayDescriptors(childrenDescriptor.value);
      if (childDescriptors === undefined) {
        return false;
      }

      // Reverse insertion retains the declared left-to-right preorder without
      // modifying the caller's Task collection.
      for (let index = childDescriptors.length - 1; index >= 0; index -= 1) {
        pending.push(childDescriptors[index]?.value);
      }
    } else if (compositionDescriptor.value !== "leaf") {
      return false;
    }
  }

  // A fixed conversation descriptor cannot be validated from configuration or
  // unknown nodes alone; at least one concrete Message input is required.
  return conversationInputCount > 0;
}

/** Validates one stored input MessageDocument. Image content is checked with the catalog. */
function hasSupportedMessageInput(descriptor: PropertyDescriptor | undefined): boolean {
  if (!isDataDescriptor(descriptor) || !isMessageDocument(descriptor.value)) {
    return false;
  }

  const document = descriptor.value;
  const descriptors = getRecordDescriptors(document);
  const purposeDescriptor = descriptors?.purpose;
  // Output documents stay representable and are outside this request range.
  return isDataDescriptor(purposeDescriptor) && purposeDescriptor.value === "input";
}
