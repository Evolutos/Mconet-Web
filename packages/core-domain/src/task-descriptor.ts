// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import { isJsonRecord } from "./model-descriptor.js";
import { isOpenIdentifier, type OpenIdentifier } from "./open-identifier.js";

/**
 * Immutable open description of one model-task contract.
 *
 * Task type identifies the task family independently from its optional version
 * and input/output Schema identities. Metadata and extensions remain portable
 * descriptive data. This interface carries no interaction mode, TaskDocument,
 * ArtifactCatalog, model target, service access, protocol, or execution behavior.
 * Untrusted values require the separate runtime validator implemented later.
 */
export interface TaskDescriptor {
  /** Standard or integration-defined task-family identity. */
  readonly type: OpenIdentifier;

  /** Optional opaque version of the selected task contract. */
  readonly version?: string;

  /** Optional identity of the task input Schema. */
  readonly inputSchemaId?: string;

  /** Optional identity of the task output Schema. */
  readonly outputSchemaId?: string;

  /** Always-present JSON-compatible descriptive task metadata. */
  readonly metadata: Readonly<Record<string, JsonValue>>;

  /** Always-present namespaced extensions for forward-compatible task data. */
  readonly extensions: Extensions;
}

/**
 * Determines whether an unknown value satisfies the task descriptor contract.
 *
 * Declared fields must be own data properties, so validation never executes
 * accessors or accepts inherited values. Task type uses the shared open-identity
 * grammar; version remains opaque but nonblank; Schema identities remain opaque
 * strings. Unknown top-level fields stay available for structural extension.
 *
 * @param value Untrusted value to validate.
 * @returns Whether the value is a valid {@link TaskDescriptor}.
 */
export function isTaskDescriptor(value: unknown): value is TaskDescriptor {
  // A descriptor is a named object rather than an ordered collection. Keep
  // reflection inside the guarded region because revoked Proxies can throw.
  if (typeof value !== "object" || value === null || isArrayValue(value)) {
    return false;
  }

  let descriptors: Record<string, PropertyDescriptor>;
  try {
    // Capturing descriptors avoids invoking declared or unknown accessors while
    // establishing own-property storage for every contract field.
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    // Reflection failure means the untrusted value cannot prove a stable own
    // property surface and therefore fails closed without invoking user code.
    return false;
  }

  const typeDescriptor = descriptors.type;
  const versionDescriptor = descriptors.version;
  const inputSchemaIdDescriptor = descriptors.inputSchemaId;
  const outputSchemaIdDescriptor = descriptors.outputSchemaId;
  const metadataDescriptor = descriptors.metadata;
  const extensionsDescriptor = descriptors.extensions;

  if (
    !isDataDescriptor(typeDescriptor) ||
    !isOpenIdentifier(typeDescriptor.value) ||
    !isOptionalNonblankStringDescriptor(versionDescriptor) ||
    !isOptionalStringDescriptor(inputSchemaIdDescriptor) ||
    !isOptionalStringDescriptor(outputSchemaIdDescriptor) ||
    !isDataDescriptor(metadataDescriptor) ||
    !isDataDescriptor(extensionsDescriptor)
  ) {
    return false;
  }

  try {
    // Validate each map as an independent JSON tree. Shared subtrees across the
    // two fields remain valid, while cycles and unsafe property shapes fail.
    return isJsonRecord(metadataDescriptor.value) && isJsonRecord(extensionsDescriptor.value);
  } catch {
    // Deep recursion or hostile nested Proxy operations are invalid boundary
    // input and must not escape as unnormalized exceptions.
    return false;
  }
}

/** Checks that a descriptor stores a value instead of invoking an accessor. */
function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { readonly value: unknown } {
  // The `value` key distinguishes a data descriptor even when its stored value
  // is undefined, which required fields reject in their subsequent checks.
  return descriptor !== undefined && "value" in descriptor;
}

/** Validates an optional opaque string data property. */
function isOptionalStringDescriptor(descriptor: PropertyDescriptor | undefined): boolean {
  // Exact optional-property semantics accept true absence only. When present,
  // Schema identity remains an uninterpreted string, including an empty string.
  return (
    descriptor === undefined ||
    (isDataDescriptor(descriptor) && typeof descriptor.value === "string")
  );
}

/** Validates an optional version string with at least one visible character. */
function isOptionalNonblankStringDescriptor(descriptor: PropertyDescriptor | undefined): boolean {
  // Version syntax stays opaque; trimming is used only to detect all-whitespace
  // content and never to normalize or replace the caller's stored value.
  return (
    descriptor === undefined ||
    (isDataDescriptor(descriptor) &&
      typeof descriptor.value === "string" &&
      descriptor.value.trim().length > 0)
  );
}

/** Safely determines whether a candidate is an array. */
function isArrayValue(value: object): boolean {
  try {
    // ECMAScript IsArray can throw for a revoked Proxy, so even this primitive
    // classification remains contained at the untrusted boundary.
    return Array.isArray(value);
  } catch {
    return true;
  }
}
