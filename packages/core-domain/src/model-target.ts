// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import { isJsonRecord, isModelDescriptor, type ModelDescriptor } from "./model-descriptor.js";
import { isOpenIdentifier, type OpenIdentifier } from "./open-identifier.js";

/**
 * Immutable interaction target separating service, protocol, and model identity.
 *
 * `serviceId` identifies the model service, while `protocolId` independently
 * selects the interaction protocol. The model descriptor and optional deployment
 * add model-level and service-side routing context without carrying endpoint,
 * authorization, task, or execution-component state. Protocol selection must
 * never be inferred from the model name or an access endpoint.
 */
export interface ModelTarget {
  /** Open identifier of the model service being addressed. */
  readonly serviceId: OpenIdentifier;

  /** Open identifier of the interaction protocol used for adapter selection. */
  readonly protocolId: OpenIdentifier;

  /** Model description passed independently from service and protocol identity. */
  readonly model: ModelDescriptor;

  /** Optional service-side deployment identifier, preserved without interpretation. */
  readonly deploymentId?: string;

  /** Always-present namespaced target extensions for forward-compatible data. */
  readonly extensions: Extensions;
}

/**
 * Determines whether an unknown value satisfies the model target contract.
 *
 * Every declared field must be an own data property so validation never runs
 * accessors or accepts inherited target state. Service and protocol identifiers,
 * the nested model descriptor, and target extensions delegate to their existing
 * validators. Unknown top-level fields remain available for structural extension
 * but do not participate in validation or protocol selection.
 *
 * @param value Untrusted value to validate.
 * @returns Whether the value is a valid {@link ModelTarget}.
 */
export function isModelTarget(value: unknown): value is ModelTarget {
  // Reject primitives and null before reflection. Array detection remains inside
  // the guarded block because ECMAScript throws when inspecting a revoked Proxy.
  if (typeof value !== "object" || value === null) {
    return false;
  }

  let descriptors: Record<string, PropertyDescriptor>;
  try {
    // A target is a named object rather than an ordered collection. Capturing
    // descriptors also avoids executing known or unknown property accessors.
    if (Array.isArray(value)) {
      return false;
    }
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    // Hostile or revoked Proxies are invalid boundary input, not thrown failures.
    return false;
  }

  const serviceIdDescriptor = descriptors.serviceId;
  const protocolIdDescriptor = descriptors.protocolId;
  const modelDescriptor = descriptors.model;
  const deploymentIdDescriptor = descriptors.deploymentId;
  const extensionsDescriptor = descriptors.extensions;

  // Required identities and nested structures must exist as own stored values.
  // The delegated validators then apply their canonical syntax and shape rules.
  if (
    !isDataDescriptor(serviceIdDescriptor) ||
    !isOpenIdentifier(serviceIdDescriptor.value) ||
    !isDataDescriptor(protocolIdDescriptor) ||
    !isOpenIdentifier(protocolIdDescriptor.value) ||
    !isDataDescriptor(modelDescriptor) ||
    !isModelDescriptor(modelDescriptor.value) ||
    !isDataDescriptor(extensionsDescriptor) ||
    !isJsonRecord(extensionsDescriptor.value)
  ) {
    return false;
  }

  // Exact optional-property semantics permit true absence only; when present,
  // deployment identity must be an own string data value without coercion.
  return (
    deploymentIdDescriptor === undefined ||
    (isDataDescriptor(deploymentIdDescriptor) && typeof deploymentIdDescriptor.value === "string")
  );
}

/**
 * Checks that a property descriptor stores a value instead of invoking accessors.
 *
 * @param descriptor Own property descriptor to inspect.
 * @returns Whether the descriptor exists and contains a data value.
 */
function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { readonly value: unknown } {
  // The descriptor-level `value` key distinguishes a stored undefined value
  // from an accessor descriptor without reading the underlying property.
  return descriptor !== undefined && "value" in descriptor;
}
