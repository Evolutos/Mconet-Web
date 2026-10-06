// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import { isJsonRecord } from "./model-descriptor.js";
import { isOpenIdentifier, type OpenIdentifier } from "./open-identifier.js";

/**
 * Immutable, open identity describing one message participant role.
 *
 * Standard role identifiers use the `message.*` namespace, while integrations
 * may provide any other {@link OpenIdentifier}. Optional semantic and raw values
 * preserve normalized meaning and source-protocol spelling independently. This
 * representation carries no authorization, message content, model parameters,
 * routing behavior, or role-validation logic.
 */
export interface MessageRole {
  /** Standard or integration-defined open role identifier. */
  readonly id: OpenIdentifier;

  /** Optional normalized meaning retained independently from role identity. */
  readonly semantic?: string;

  /** Optional original source-protocol role value preserved without coercion. */
  readonly rawValue?: string;

  /** Always-present namespaced role extensions for forward-compatible data. */
  readonly extensions: Extensions;
}

/**
 * Determines whether an unknown value satisfies the message-role contract.
 *
 * Known fields must be own data properties so validation never executes an
 * accessor or trusts inherited state. Unknown top-level fields remain available
 * for structural forward compatibility but do not participate in validation.
 *
 * @param value Untrusted value to validate.
 * @returns Whether the value is a valid {@link MessageRole}.
 */
export function isMessageRole(value: unknown): value is MessageRole {
  // Reject primitives and null before reflection. Array detection stays inside
  // the guarded block because ECMAScript throws for a revoked Proxy.
  if (typeof value !== "object" || value === null) {
    return false;
  }

  let descriptors: Record<string, PropertyDescriptor>;
  try {
    // A role is a named record rather than an ordered collection. Capturing all
    // descriptors avoids running known or unknown property accessors.
    if (Array.isArray(value)) {
      return false;
    }
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    // Hostile or revoked proxies are invalid boundary data, not thrown failures.
    return false;
  }

  const idDescriptor = descriptors.id;
  const extensionsDescriptor = descriptors.extensions;

  // Both required fields must be stored directly. Identifier syntax and the
  // recursive extension map delegate to existing domain validators.
  if (
    !isDataDescriptor(idDescriptor) ||
    !isOpenIdentifier(idDescriptor.value) ||
    !isDataDescriptor(extensionsDescriptor) ||
    !isOptionalStringDescriptor(descriptors.semantic) ||
    !isOptionalStringDescriptor(descriptors.rawValue)
  ) {
    return false;
  }

  // The shared validator already contains recursive-depth and hostile-proxy
  // failures. A fresh set scopes cycle detection to this extension tree while
  // preserving repeated non-cyclic references in sibling branches.
  return isJsonRecord(extensionsDescriptor.value, new Set<object>());
}

/** Checks that a property descriptor stores a value rather than an accessor. */
function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { readonly value: unknown } {
  // The `value` key distinguishes a stored undefined value from an accessor.
  return descriptor !== undefined && "value" in descriptor;
}

/** Validates true absence or an own string data property. */
function isOptionalStringDescriptor(descriptor: PropertyDescriptor | undefined): boolean {
  // Exact optional semantics reject present undefined and accessor-backed data.
  return (
    descriptor === undefined ||
    (isDataDescriptor(descriptor) && typeof descriptor.value === "string")
  );
}
