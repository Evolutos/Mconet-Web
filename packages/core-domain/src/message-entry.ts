// Copyright © 2026 Mcont.

import type { MessageContent } from "./message-content.js";
import type { MessageElementBase } from "./message-element-base.js";
import { isJsonRecord } from "./model-descriptor.js";
import { isOpenIdentifier } from "./open-identifier.js";
import { isMessageRole, type MessageRole } from "./message-role.js";
import { isTextMessageContent } from "./text-message-content.js";

/**
 * Immutable leaf message element carrying one participant's ordered content.
 *
 * The fixed kind distinguishes entries from message containers. Content remains
 * an ordered collection of MessageContent values rather than child tree nodes;
 * the interface intentionally declares no children, task parameters, endpoint,
 * authorization, model, protocol, or execution fields.
 */
export interface MessageEntry extends MessageElementBase {
  /** Fixed discriminator for a leaf message entry. */
  readonly kind: "message.entry";

  /** Participant role associated with every content value in this entry. */
  readonly role: MessageRole;

  /** Ordered content values owned by this leaf element. */
  readonly content: readonly MessageContent[];
}

/**
 * Determines whether an unknown value satisfies the message-entry leaf contract.
 *
 * Validation preserves content and relation order, requires at least one content
 * value, and rejects a `children` field so an entry cannot carry container state.
 * Document-wide identity uniqueness and relation endpoint resolution remain the
 * responsibility of the enclosing document validator.
 *
 * @param value Untrusted value to validate.
 * @returns Whether the value is a valid {@link MessageEntry}.
 */
export function isMessageEntry(value: unknown): value is MessageEntry {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return false;
  }

  const idDescriptor = descriptors.id;
  const kindDescriptor = descriptors.kind;
  const roleDescriptor = descriptors.role;
  const contentDescriptor = descriptors.content;
  const relationsDescriptor = descriptors.relations;
  const metadataDescriptor = descriptors.metadata;
  const extensionsDescriptor = descriptors.extensions;

  // Every declared field must be stored directly. The reserved children field
  // is rejected even when empty because entries are leaves, not containers.
  return (
    descriptors.children === undefined &&
    isDataDescriptor(idDescriptor) &&
    isOpenIdentifier(idDescriptor.value) &&
    isDataDescriptor(kindDescriptor) &&
    kindDescriptor.value === "message.entry" &&
    isDataDescriptor(roleDescriptor) &&
    isMessageRole(roleDescriptor.value) &&
    isDataDescriptor(contentDescriptor) &&
    isMessageContentArray(contentDescriptor.value) &&
    isDataDescriptor(relationsDescriptor) &&
    isMessageRelationArray(relationsDescriptor.value) &&
    isDataDescriptor(metadataDescriptor) &&
    isJsonRecord(metadataDescriptor.value, new Set<object>()) &&
    isDataDescriptor(extensionsDescriptor) &&
    isJsonRecord(extensionsDescriptor.value, new Set<object>())
  );
}

/**
 * Captures own descriptors for a non-array object without invoking accessors.
 *
 * @internal Shared by adjacent Message validators; not exported by the package entry.
 */
export function getRecordDescriptors(
  value: unknown,
): Record<string, PropertyDescriptor> | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  try {
    // Message records and their nested structures are never ordered root arrays.
    return Array.isArray(value) ? undefined : Object.getOwnPropertyDescriptors(value);
  } catch {
    // Revoked or hostile Proxies fail closed at the trust boundary.
    return undefined;
  }
}

/**
 * Checks that a property descriptor stores a value rather than an accessor.
 *
 * @internal Shared by adjacent Message validators; not exported by the package entry.
 */
export function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { readonly value: unknown } {
  // The key remains present for a stored undefined value but not an accessor.
  return descriptor !== undefined && "value" in descriptor;
}

/** Validates a non-empty dense array of message-content values in place. */
function isMessageContentArray(value: unknown): value is readonly MessageContent[] {
  const descriptors = getDenseArrayDescriptors(value);
  if (descriptors === undefined || descriptors.length === 0) {
    return false;
  }

  for (const descriptor of descriptors) {
    // Iteration follows numeric index order and validates without reading an
    // element getter, preserving the caller's original content collection.
    if (!isMessageContentValue(descriptor.value)) {
      return false;
    }
  }
  return true;
}

/** Validates shared and variant-specific fields of one content value. */
function isMessageContentValue(value: unknown): value is MessageContent {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return false;
  }

  const kindDescriptor = descriptors.kind;
  if (!isDataDescriptor(kindDescriptor) || !isOpenIdentifier(kindDescriptor.value)) {
    return false;
  }

  // The standard text discriminator must satisfy the concrete text validator;
  // other open kinds retain only the shared unknown-content representation.
  if (kindDescriptor.value === "content.text") {
    return isTextMessageContent(value);
  }

  const idDescriptor = descriptors.id;
  const metadataDescriptor = descriptors.metadata;
  const extensionsDescriptor = descriptors.extensions;
  const rawDescriptor = descriptors.raw;
  return (
    isDataDescriptor(idDescriptor) &&
    isOpenIdentifier(idDescriptor.value) &&
    isDataDescriptor(metadataDescriptor) &&
    isJsonRecord(metadataDescriptor.value, new Set<object>()) &&
    isDataDescriptor(extensionsDescriptor) &&
    isJsonRecord(extensionsDescriptor.value, new Set<object>()) &&
    (rawDescriptor === undefined ||
      (isDataDescriptor(rawDescriptor) && isRawPayloadValue(rawDescriptor.value)))
  );
}

/** Validates the optional raw payload carried by unknown message content. */
function isRawPayloadValue(value: unknown): boolean {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return false;
  }

  const bytesDescriptor = descriptors.bytes;
  const truncatedDescriptor = descriptors.truncated;
  const metadataDescriptor = descriptors.metadata;
  try {
    // Raw bytes retain their Uint8Array view; no read, copy, or size policy is
    // applied by the entry validator.
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
    // A hostile byte value must not escape through instanceof or nested checks.
    return false;
  }
}

/**
 * Validates a dense ordered array of local relation descriptions.
 *
 * @internal Shared by adjacent Message validators; not exported by the package entry.
 */
export function isMessageRelationArray(value: unknown): boolean {
  const descriptors = getDenseArrayDescriptors(value);
  if (descriptors === undefined) {
    return false;
  }

  for (const descriptor of descriptors) {
    // Relation order is observed by numeric descriptor index and never sorted.
    if (!isMessageRelationValue(descriptor.value)) {
      return false;
    }
  }
  return true;
}

/** Validates one relation shape without resolving its document-local endpoints. */
function isMessageRelationValue(value: unknown): boolean {
  const descriptors = getRecordDescriptors(value);
  if (descriptors === undefined) {
    return false;
  }

  const sourceIdDescriptor = descriptors.sourceId;
  const targetIdDescriptor = descriptors.targetId;
  const typeDescriptor = descriptors.type;
  const metadataDescriptor = descriptors.metadata;
  // Endpoint existence needs the complete document, but local syntax and JSON
  // portability are safe to establish at the entry boundary.
  return (
    isDataDescriptor(sourceIdDescriptor) &&
    isOpenIdentifier(sourceIdDescriptor.value) &&
    isDataDescriptor(targetIdDescriptor) &&
    isOpenIdentifier(targetIdDescriptor.value) &&
    isDataDescriptor(typeDescriptor) &&
    isOpenIdentifier(typeDescriptor.value) &&
    isDataDescriptor(metadataDescriptor) &&
    isJsonRecord(metadataDescriptor.value, new Set<object>())
  );
}

/**
 * Returns indexed data descriptors for a dense ordinary array.
 *
 * @internal Shared by adjacent Message validators; not exported by the package entry.
 */
export function getDenseArrayDescriptors(
  value: unknown,
): readonly (PropertyDescriptor & { readonly value: unknown })[] | undefined {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return undefined;
    }

    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    const keys = Reflect.ownKeys(value);
    if (
      !isDataDescriptor(lengthDescriptor) ||
      typeof lengthDescriptor.value !== "number" ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      keys.length !== lengthDescriptor.value + 1
    ) {
      return undefined;
    }

    const descriptors: (PropertyDescriptor & { readonly value: unknown })[] = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      // Dense arrays expose every numeric item as an enumerable data property;
      // holes, getters, symbols, and unrelated own properties fail this shape.
      if (!isDataDescriptor(descriptor) || descriptor.enumerable !== true) {
        return undefined;
      }
      descriptors.push(descriptor);
    }
    return descriptors;
  } catch {
    // Nested revoked Proxies are invalid rather than observable exceptions.
    return undefined;
  }
}

/** Validates true absence or an own string data property. */
function isOptionalStringDescriptor(descriptor: PropertyDescriptor | undefined): boolean {
  // Exact optional semantics reject explicit undefined and accessors.
  return (
    descriptor === undefined ||
    (isDataDescriptor(descriptor) && typeof descriptor.value === "string")
  );
}
