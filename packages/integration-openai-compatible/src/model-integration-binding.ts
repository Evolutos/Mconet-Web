// Copyright © 2026 Mcont.

import type { Extensions, JsonValue, ServiceAccess } from "@evolutos/mconet-core-domain";
import type { RuntimeComponent } from "@evolutos/mconet-core-spi";

import { createIntegrationTypeKey, type IntegrationTypeKey } from "./integration-type-key.js";

/**
 * Internal composition of the components that serve one integration key.
 *
 * This is not a registration record. Creating a binding does not publish it,
 * replace another binding, or make it discoverable by model name.
 */
export interface ModelIntegrationBinding {
  /** Selecting protocol, task type, and mode. */
  readonly key: IntegrationTypeKey;

  /** Stable label stored with a resolved plan. */
  readonly bindingId: string;

  /** Version stored with a resolved plan. */
  readonly bindingVersion: string;

  /** Protocol adapter used for this key. */
  readonly taskProtocolAdapter: RuntimeComponent;

  /** Authorization handlers owned by this binding, in candidate order. */
  readonly authorizationHandlers: readonly RuntimeComponent[];

  /** Payload encoders owned by this binding, in candidate order. */
  readonly payloadEncoders: readonly RuntimeComponent[];

  /** Payload decoders owned by this binding, in candidate order. */
  readonly payloadDecoders: readonly RuntimeComponent[];

  /** Transports owned by this binding, in candidate order. */
  readonly transports: readonly RuntimeComponent[];

  /** Access defaults, when the binding supplies them. */
  readonly defaultServiceAccess?: ServiceAccess;

  /** Opaque binding-local values. */
  readonly extensions: Extensions;
}

/**
 * Creates one frozen binding from its key and component roles.
 *
 * The arrays are copied, so later changes to the caller's arrays do not change
 * the binding. Nothing is added to a table. A credential source on the optional
 * access value is not read.
 *
 * @param input Key, identity, and component roles.
 * @returns The frozen binding.
 * @throws TypeError When an identity or a component role is missing.
 */
export function createModelIntegrationBinding(input: {
  readonly key: IntegrationTypeKey;
  readonly bindingId: string;
  readonly bindingVersion: string;
  readonly taskProtocolAdapter: RuntimeComponent;
  readonly authorizationHandlers: readonly RuntimeComponent[];
  readonly payloadEncoders: readonly RuntimeComponent[];
  readonly payloadDecoders: readonly RuntimeComponent[];
  readonly transports: readonly RuntimeComponent[];
  readonly defaultServiceAccess?: ServiceAccess;
  readonly extensions?: Extensions;
}): ModelIntegrationBinding {
  const bindingId = requireText(input.bindingId, "bindingId");
  const bindingVersion = requireText(input.bindingVersion, "bindingVersion");
  const taskProtocolAdapter = requireComponent(input.taskProtocolAdapter, "taskProtocolAdapter");
  // Rebuild the key so an extra model field on the input cannot be retained.
  const key = createIntegrationTypeKey(input.key);
  const binding: {
    key: IntegrationTypeKey;
    bindingId: string;
    bindingVersion: string;
    taskProtocolAdapter: RuntimeComponent;
    authorizationHandlers: readonly RuntimeComponent[];
    payloadEncoders: readonly RuntimeComponent[];
    payloadDecoders: readonly RuntimeComponent[];
    transports: readonly RuntimeComponent[];
    extensions: Extensions;
    defaultServiceAccess?: ServiceAccess;
  } = {
    key,
    bindingId,
    bindingVersion,
    taskProtocolAdapter,
    authorizationHandlers: copyComponents(input.authorizationHandlers, "authorizationHandlers"),
    payloadEncoders: copyComponents(input.payloadEncoders, "payloadEncoders"),
    payloadDecoders: copyComponents(input.payloadDecoders, "payloadDecoders"),
    transports: copyComponents(input.transports, "transports"),
    extensions: copyExtensions(input.extensions),
  };
  if (input.defaultServiceAccess !== undefined) {
    binding.defaultServiceAccess = input.defaultServiceAccess;
  }
  return Object.freeze(binding);
}

/**
 * Returns a non-blank identity string.
 *
 * @param value Candidate text.
 * @param name Field name used in the failure.
 * @returns The same text.
 */
function requireText(value: string, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`Integration binding ${name} must be non-blank text.`);
  }
  return value;
}

/**
 * Returns a component that has a descriptor object.
 *
 * @param value Candidate component.
 * @param name Field name used in the failure.
 * @returns The same component.
 */
function requireComponent(value: RuntimeComponent, name: string): RuntimeComponent {
  if (typeof value !== "object" || value === null || typeof value.descriptor !== "object") {
    throw new TypeError(`Integration binding ${name} must be a runtime component.`);
  }
  return value;
}

/**
 * Copies one component list in caller order.
 *
 * @param values Candidate components.
 * @param name Field name used in the failure.
 * @returns A frozen copy.
 */
function copyComponents(
  values: readonly RuntimeComponent[],
  name: string,
): readonly RuntimeComponent[] {
  if (!Array.isArray(values)) {
    throw new TypeError(`Integration binding ${name} must be an array.`);
  }
  return Object.freeze(values.map((value) => requireComponent(value, name)));
}

/**
 * Copies extension entries without invoking accessors.
 *
 * @param value Candidate extensions.
 * @returns A frozen copy, or an empty object when omitted.
 */
function copyExtensions(value: Extensions | undefined): Extensions {
  if (value === undefined) {
    return Object.freeze({});
  }
  return Object.freeze(readJsonRecord(value, new Set()));
}

/**
 * Copies one JSON object.
 *
 * Arrays and primitives are rejected here. Nested values are copied by
 * {@link readJsonValue}.
 *
 * @param value Candidate extensions object.
 * @param seen Objects already entered, so a cycle fails instead of looping.
 * @returns A mutable JSON object suitable for freezing.
 */
function readJsonRecord(value: unknown, seen: Set<object>): Record<string, JsonValue> {
  // Reject arrays before reading keys. A JSON array satisfies an index signature,
  // so a later array check would not narrow it away from an object.
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Integration binding extensions must be an object.");
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Integration binding extensions must be JSON.");
  }
  if (seen.has(value)) {
    throw new TypeError("Integration binding extensions must be JSON.");
  }
  seen.add(value);
  const record: Record<string, JsonValue> = {};
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      record[key] = readJsonValue(descriptor.value, seen);
    }
  }
  seen.delete(value);
  return record;
}

/**
 * Copies one JSON value, rejecting cycles and non-JSON values.
 *
 * @param value Candidate value.
 * @param seen Objects already entered, so a cycle fails instead of looping.
 * @returns A JSON copy.
 */
function readJsonValue(value: unknown, seen: Set<object>): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw new TypeError("Integration binding extensions must be JSON.");
    }
    return value;
  }
  if (typeof value !== "object") {
    throw new TypeError("Integration binding extensions must be JSON.");
  }
  if (seen.has(value)) {
    throw new TypeError("Integration binding extensions must be JSON.");
  }
  seen.add(value);
  if (Array.isArray(value)) {
    const copy = value.map((entry) => readJsonValue(entry, seen));
    seen.delete(value);
    return copy;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Integration binding extensions must be JSON.");
  }
  const copy: Record<string, JsonValue> = {};
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      copy[key] = readJsonValue(descriptor.value, seen);
    }
  }
  seen.delete(value);
  return copy;
}
