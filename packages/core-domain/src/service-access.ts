// Copyright © 2026 Mcont.

import type { Authorization } from "./authorization.js";
import type { Extensions } from "./extensions.js";
import type { HeaderField } from "./header-field.js";
import type { HeaderFields } from "./header-fields.js";
import { isJsonRecord } from "./model-descriptor.js";
import { isOpenIdentifier } from "./open-identifier.js";
import type { QueryField } from "./query-field.js";
import type { QueryFields } from "./query-fields.js";
import { isUriValue, type UriValue } from "./uri-value.js";

/**
 * Immutable unresolved configuration for connecting to a model service.
 *
 * Optional fields retain caller-level defaulting semantics until a dedicated
 * resolver produces a complete access snapshot. Headers, query fields, and
 * extensions remain non-sensitive data; credentials belong exclusively to a
 * concrete authorization description and its credential source.
 */
export interface ServiceAccess {
  /** Optional endpoint URI reference supplied at this configuration level. */
  readonly endpoint?: UriValue;

  /** Optional authorization description supplied at this configuration level. */
  readonly authorization?: Authorization;

  /** Ordered non-sensitive header occurrences contributed by this configuration. */
  readonly headers: HeaderFields;

  /** Ordered query occurrences contributed by this configuration. */
  readonly query: QueryFields;

  /** Optional service API version hint interpreted by the selected integration. */
  readonly apiVersion?: string;

  /** Optional provider project identifier without credential semantics. */
  readonly projectId?: string;

  /** Optional provider tenant identifier without credential semantics. */
  readonly tenantId?: string;

  /** Protocol-independent extension data for explicitly supported consumers. */
  readonly extensions: Extensions;
}

/** RFC 9110 field-name token restricted to the shared lowercase form. */
const normalizedHeaderName = /^[!#$%&'*+\-.^_`|~0-9a-z]+$/u;

/** Line breaks forbidden in header values to prevent field injection. */
const headerLineBreak = /[\r\n]/u;

/** Absolute HTTP(S) URI prefix with a non-empty authority capture. */
const httpEndpointAuthority = /^https?:\/\/([^/?#]+)(?:[/?]|$)/iu;

/** Bracketed IP-literal authority with an optional decimal port. */
const bracketedEndpointAuthority = /^\[[^\]]+\](?::[0-9]+)?$/u;

/** Non-bracketed host authority with an optional decimal port. */
const namedEndpointAuthority = /^[^:]+(?::[0-9]+)?$/u;

/**
 * Determines whether an unknown value satisfies the service access contract.
 *
 * Known fields must be own data properties so validation does not execute
 * accessors or accept inherited configuration. Endpoints are absolute HTTP(S)
 * URLs without embedded credentials or fragments. Header and query occurrences
 * retain their declared order, while extension data delegates to the shared JSON
 * record validator. Unknown top-level fields remain structurally extensible and
 * are not read or interpreted.
 *
 * @param value Untrusted value to validate.
 * @returns Whether the value is a valid {@link ServiceAccess}.
 */
export function isServiceAccess(value: unknown): value is ServiceAccess {
  // Service access is a named object, never a primitive or ordered collection.
  // Keep array and descriptor reflection guarded because revoked Proxies throw.
  if (typeof value !== "object" || value === null) {
    return false;
  }

  let descriptors: Record<string, PropertyDescriptor>;
  try {
    if (Array.isArray(value)) {
      return false;
    }
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return false;
  }

  const headersDescriptor = descriptors.headers;
  const queryDescriptor = descriptors.query;
  const extensionsDescriptor = descriptors.extensions;

  // Required containers must be stored own values. Their validators preserve
  // sequence semantics and reject unsafe or structurally incomplete elements.
  if (
    !isDataDescriptor(headersDescriptor) ||
    !isHeaderFields(headersDescriptor.value) ||
    !isDataDescriptor(queryDescriptor) ||
    !isQueryFields(queryDescriptor.value) ||
    !isDataDescriptor(extensionsDescriptor) ||
    !isJsonRecord(extensionsDescriptor.value)
  ) {
    return false;
  }

  // Optional fields use exact absence semantics. A present undefined value,
  // accessor, malformed endpoint, or invalid authorization kind fails closed.
  return (
    isOptionalEndpointDescriptor(descriptors.endpoint) &&
    isOptionalAuthorizationDescriptor(descriptors.authorization) &&
    isOptionalStringDescriptor(descriptors.apiVersion) &&
    isOptionalStringDescriptor(descriptors.projectId) &&
    isOptionalStringDescriptor(descriptors.tenantId)
  );
}

/**
 * Checks that a property descriptor stores a value rather than invoking accessors.
 *
 * @param descriptor Own property descriptor to inspect.
 * @returns Whether the descriptor exists and contains a data value.
 */
function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { readonly value: unknown } {
  // The descriptor-level key identifies data properties even when their stored
  // value is undefined, allowing optional helpers to reject that case explicitly.
  return descriptor !== undefined && "value" in descriptor;
}

/**
 * Validates an optional endpoint property as a safe absolute HTTP(S) URL.
 *
 * @param descriptor Optional endpoint descriptor.
 * @returns Whether the endpoint is absent or stores an allowed URI value.
 */
function isOptionalEndpointDescriptor(descriptor: PropertyDescriptor | undefined): boolean {
  if (descriptor === undefined) {
    return true;
  }
  if (!isDataDescriptor(descriptor) || !isUriValue(descriptor.value)) {
    return false;
  }

  const endpoint = descriptor.value;
  if (endpoint.kind !== "absolute" || endpoint.value.includes("#")) {
    return false;
  }

  // UriValue already guarantees legal URI characters and percent triplets. This
  // pure-core check adds HTTP(S), authority, credential, host, and port policy
  // without importing a mutable or platform-provided URL implementation.
  const authorityMatch = httpEndpointAuthority.exec(endpoint.value);
  const authority = authorityMatch?.[1];
  if (!authority || authority.includes("@")) {
    return false;
  }

  // Full hostname, IP-literal, and reachable-port policy belongs to the selected
  // transport. This boundary only rejects empty/ambiguous host-port structures.
  return authority.startsWith("[")
    ? bracketedEndpointAuthority.test(authority)
    : namedEndpointAuthority.test(authority);
}

/**
 * Validates an optional open authorization description.
 *
 * @param descriptor Optional authorization descriptor.
 * @returns Whether it is absent or stores an object with a valid own kind.
 */
function isOptionalAuthorizationDescriptor(descriptor: PropertyDescriptor | undefined): boolean {
  if (descriptor === undefined) {
    return true;
  }
  if (!isDataDescriptor(descriptor)) {
    return false;
  }

  const authorization = descriptor.value;
  if (typeof authorization !== "object" || authorization === null) {
    return false;
  }

  try {
    // Authorization is an open structural protocol. Inspect only its stable kind
    // discriminator and never enumerate scheme-specific or secret-bearing fields.
    if (Array.isArray(authorization)) {
      return false;
    }
    const kindDescriptor = Object.getOwnPropertyDescriptor(authorization, "kind");
    return isDataDescriptor(kindDescriptor) && isOpenIdentifier(kindDescriptor.value);
  } catch {
    return false;
  }
}

/**
 * Validates an optional own string data property.
 *
 * @param descriptor Optional property descriptor.
 * @returns Whether the property is absent or stores a string.
 */
function isOptionalStringDescriptor(descriptor: PropertyDescriptor | undefined): boolean {
  // Empty strings remain provider-defined values; this boundary only enforces
  // the declared type and exact optional-property behavior.
  return (
    descriptor === undefined ||
    (isDataDescriptor(descriptor) && typeof descriptor.value === "string")
  );
}

/**
 * Validates an ordered header occurrence collection without invoking accessors.
 *
 * @param value Candidate header collection.
 * @returns Whether every dense array element is a valid {@link HeaderField}.
 */
function isHeaderFields(value: unknown): value is HeaderFields {
  return isDenseOccurrenceArray(value, isHeaderField);
}

/**
 * Validates one normalized, injection-safe header occurrence.
 *
 * @param value Candidate header occurrence.
 * @returns Whether it has valid own name and value data fields.
 */
function isHeaderField(value: unknown): value is HeaderField {
  const descriptors = getObjectDescriptors(value);
  if (!descriptors) {
    return false;
  }

  const nameDescriptor = descriptors.name;
  const valueDescriptor = descriptors.value;
  // Names use the shared lowercase token form. Values stay verbatim except for
  // CR/LF rejection, which closes the cross-platform header-injection boundary.
  return (
    isDataDescriptor(nameDescriptor) &&
    typeof nameDescriptor.value === "string" &&
    normalizedHeaderName.test(nameDescriptor.value) &&
    isDataDescriptor(valueDescriptor) &&
    typeof valueDescriptor.value === "string" &&
    !headerLineBreak.test(valueDescriptor.value)
  );
}

/**
 * Validates an ordered query occurrence collection without encoding its text.
 *
 * @param value Candidate query collection.
 * @returns Whether every dense array element is a valid {@link QueryField}.
 */
function isQueryFields(value: unknown): value is QueryFields {
  return isDenseOccurrenceArray(value, isQueryField);
}

/**
 * Validates one pre-encoding query occurrence.
 *
 * @param value Candidate query occurrence.
 * @returns Whether it has own string name and value data fields.
 */
function isQueryField(value: unknown): value is QueryField {
  const descriptors = getObjectDescriptors(value);
  if (!descriptors) {
    return false;
  }

  const nameDescriptor = descriptors.name;
  const valueDescriptor = descriptors.value;
  // Empty strings and reserved or Unicode characters remain valid pre-encoding
  // input. The transport owns percent-encoding and final URL construction.
  return (
    isDataDescriptor(nameDescriptor) &&
    typeof nameDescriptor.value === "string" &&
    isDataDescriptor(valueDescriptor) &&
    typeof valueDescriptor.value === "string"
  );
}

/**
 * Validates a dense array by inspecting element descriptors in source order.
 *
 * @param value Candidate occurrence array.
 * @param isElement Validator for a stored element value.
 * @returns Whether the candidate is a dense array of valid elements.
 */
function isDenseOccurrenceArray<T>(
  value: unknown,
  isElement: (element: unknown) => element is T,
): value is readonly T[] {
  try {
    if (!Array.isArray(value)) {
      return false;
    }

    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      !isDataDescriptor(lengthDescriptor) ||
      typeof lengthDescriptor.value !== "number" ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    ) {
      return false;
    }

    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      // Reading the indexed descriptor rejects holes and accessors without
      // invoking user code or changing the occurrence order.
      const elementDescriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!isDataDescriptor(elementDescriptor) || !isElement(elementDescriptor.value)) {
        return false;
      }
    }
    return true;
  } catch {
    // Revoked or hostile collection Proxies fail closed at the trust boundary.
    return false;
  }
}

/**
 * Captures descriptors from a non-array object while containing Proxy failures.
 *
 * @param value Candidate occurrence value.
 * @returns Own descriptors, or undefined when the value is not a safe named object.
 */
function getObjectDescriptors(value: unknown): Record<string, PropertyDescriptor> | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  try {
    // Header and query occurrences are named records rather than nested arrays.
    return Array.isArray(value) ? undefined : Object.getOwnPropertyDescriptors(value);
  } catch {
    return undefined;
  }
}
