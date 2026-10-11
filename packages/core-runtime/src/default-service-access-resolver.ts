// Copyright © 2026 Mcont.

import {
  isOpenIdentifier,
  isServiceAccess,
  ModelInteractionError,
  type Authorization,
  type Extensions,
  type HeaderField,
  type HeaderFields,
  type JsonValue,
  type QueryField,
  type QueryFields,
  type ResolvedServiceAccess,
  type ServiceAccess,
} from "@evolutos/mconet-core-domain";
import type { ComponentDescriptor, ServiceAccessResolver } from "@evolutos/mconet-core-spi";

/** Diagnostic component name. It is not a registry key or selection identity. */
const DEFAULT_SERVICE_ACCESS_RESOLVER_NAME = "default-service-access-resolver";

/** Descriptive implementation version. It is not the package version. */
const DEFAULT_SERVICE_ACCESS_RESOLVER_VERSION = "1.0.0";

/** Stable code for access that cannot form a complete execution snapshot. */
const SERVICE_ACCESS_INCOMPLETE_CODE = "service_access_incomplete";

/** Layer roles in documented highest-to-lowest precedence order. */
const serviceAccessLayerNames = [
  "interactionOverride",
  "requestAccess",
  "clientDefault",
  "integrationDefault",
] as const;

/** One labelled configuration layer accepted by the resolver. */
type ServiceAccessLayerName = (typeof serviceAccessLayerNames)[number];

/** Detached view of one validated layer, with omission preserved per field. */
interface ServiceAccessLayerSnapshot {
  readonly endpoint?: ResolvedServiceAccess["endpoint"];
  readonly authorization?: Authorization;
  readonly headers: HeaderFields;
  readonly query: QueryFields;
  readonly apiVersion?: string;
  readonly projectId?: string;
  readonly tenantId?: string;
  readonly extensions: Extensions;
}

/**
 * Metadata shared by every default service-access resolver instance.
 *
 * Name, version, and source are diagnostic facts. Resolution has no port
 * contract and provides no selectable capability. This value is not a registry
 * identity and it does not register the resolver.
 */
export const defaultServiceAccessResolverDescriptor: ComponentDescriptor = {
  name: DEFAULT_SERVICE_ACCESS_RESOLVER_NAME,
  version: DEFAULT_SERVICE_ACCESS_RESOLVER_VERSION,
  capabilities: new Set(),
  source: "builtin",
};

/**
 * Merges four service-access layers into one immutable execution snapshot.
 *
 * Each optional scalar uses the highest layer that actually supplies it.
 * Authorization is copied as one atomic description and is never combined with
 * a lower layer's authorization fields. Header and query collections are also
 * atomic: the highest non-empty collection wins, because the input type always
 * requires those arrays and an empty array means the layer contributes none.
 * Extensions follow the same rule at the map level, so a higher map replaces a
 * lower map instead of deep-merging vendor objects.
 *
 * The resolver validates every supplied layer before selection, including a
 * lower layer replaced by a higher one. It does not read credentials, call a
 * credential source, mutate inputs, or perform I/O.
 */
export class DefaultServiceAccessResolver implements ServiceAccessResolver {
  /** Shared descriptor for this builtin configuration resolver. */
  public readonly descriptor = defaultServiceAccessResolverDescriptor;

  /**
   * Resolves labelled layers into one complete access snapshot.
   *
   * @param input Optional layers from interaction, request, client, and integration.
   * @returns A new frozen snapshot with one absolute endpoint and one authorization.
   * @throws {TypeError} When any supplied layer violates the service-access contract.
   * @throws {ModelInteractionError} When no layer supplies an endpoint or authorization.
   */
  public resolve(input: {
    readonly interactionOverride?: ServiceAccess;
    readonly requestAccess?: ServiceAccess;
    readonly clientDefault?: ServiceAccess;
    readonly integrationDefault?: ServiceAccess;
  }): ResolvedServiceAccess {
    // Snapshot every present layer before choosing winners so an invalid lower
    // layer cannot hide behind a complete override, and later caller mutation
    // cannot change a field while the result is assembled.
    const layers = serviceAccessLayerNames.map((layerName) =>
      snapshotLayer(layerName, input[layerName]),
    );
    const endpoint = firstPresent(layers, "endpoint");
    const authorization = firstPresent(layers, "authorization");
    const apiVersion = firstPresent(layers, "apiVersion");
    const projectId = firstPresent(layers, "projectId");
    const tenantId = firstPresent(layers, "tenantId");

    // Endpoint and authorization are mandatory after resolution. Omission is
    // not converted into an implicit no-auth or relative base.
    if (endpoint === undefined || authorization === undefined) {
      throw createIncompleteServiceAccessError(endpoint === undefined, authorization === undefined);
    }

    // Optional provider context stays absent when every layer omitted it.
    // Empty strings remain explicit values and are assigned above when present.
    return Object.freeze({
      endpoint,
      authorization,
      headers: firstExplicitCollection(layers, "headers"),
      query: firstExplicitCollection(layers, "query"),
      extensions: firstExplicitExtensions(layers),
      ...(apiVersion === undefined ? {} : { apiVersion }),
      ...(projectId === undefined ? {} : { projectId }),
      ...(tenantId === undefined ? {} : { tenantId }),
    });
  }
}

/**
 * Validates and detaches one layer.
 *
 * @param layerName Precedence role used only in failure diagnostics.
 * @param value Optional caller-owned access value.
 * @returns A frozen field snapshot, or undefined when the layer was omitted.
 * @throws {TypeError} When the value is not valid service access.
 */
function snapshotLayer(
  layerName: ServiceAccessLayerName,
  value: ServiceAccess | undefined,
): ServiceAccessLayerSnapshot | undefined {
  if (value === undefined) {
    return undefined;
  }

  // Reject contract failures and hostile reflection with one stable message.
  // The message names the layer role and never echoes endpoint or header text.
  try {
    if (!isServiceAccess(value)) {
      throw invalidLayer(layerName);
    }
    return captureLayer(layerName, value);
  } catch (error) {
    if (error instanceof TypeError && error.message === invalidLayerMessage(layerName)) {
      throw error;
    }
    throw invalidLayer(layerName);
  }
}

/**
 * Copies the known fields of a layer that already passed validation.
 *
 * @param layerName Precedence role used when a raced proxy no longer validates.
 * @param value Validated caller-owned access value.
 * @returns Detached field values for precedence selection.
 * @throws {TypeError} When own descriptors drift from the service-access contract.
 */
function captureLayer(
  layerName: ServiceAccessLayerName,
  value: ServiceAccess,
): ServiceAccessLayerSnapshot {
  let descriptors: Record<string, PropertyDescriptor>;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw invalidLayer(layerName);
  }

  const endpoint = captureEndpoint(layerName, descriptors.endpoint);
  const authorization = captureAuthorization(layerName, descriptors.authorization);
  const headers = captureHeaders(layerName, descriptors.headers);
  const query = captureQuery(layerName, descriptors.query);
  const extensions = captureExtensions(layerName, descriptors.extensions);
  const apiVersion = captureOptionalString(layerName, descriptors.apiVersion);
  const projectId = captureOptionalString(layerName, descriptors.projectId);
  const tenantId = captureOptionalString(layerName, descriptors.tenantId);

  return Object.freeze({
    headers,
    query,
    extensions,
    ...(endpoint === undefined ? {} : { endpoint }),
    ...(authorization === undefined ? {} : { authorization }),
    ...(apiVersion === undefined ? {} : { apiVersion }),
    ...(projectId === undefined ? {} : { projectId }),
    ...(tenantId === undefined ? {} : { tenantId }),
  });
}

/**
 * Copies an optional absolute endpoint without retaining the source object.
 *
 * @param layerName Layer role reported when the descriptor is no longer valid.
 * @param descriptor Own endpoint descriptor, if the property exists.
 * @returns A frozen absolute URI value, or undefined when the field is absent.
 * @throws {TypeError} When a present endpoint is not an absolute URI value.
 */
function captureEndpoint(
  layerName: ServiceAccessLayerName,
  descriptor: PropertyDescriptor | undefined,
): ResolvedServiceAccess["endpoint"] | undefined {
  if (descriptor === undefined) {
    return undefined;
  }
  if (!isDataDescriptor(descriptor)) {
    throw invalidLayer(layerName);
  }

  const endpoint = descriptor.value;
  if (
    typeof endpoint !== "object" ||
    endpoint === null ||
    !isDataValue(endpoint, "kind", "absolute") ||
    !isOwnString(endpoint, "value")
  ) {
    throw invalidLayer(layerName);
  }

  // Copy the two URI fields into a new object so later replacement of the
  // source endpoint cannot change the resolved snapshot.
  return Object.freeze({
    kind: "absolute",
    value: readOwnString(endpoint, "value"),
  });
}

/**
 * Copies one authorization description without merging or invoking accessors.
 *
 * @param layerName Layer role reported when authorization data is unreadable.
 * @param descriptor Own authorization descriptor, if the property exists.
 * @returns A frozen shallow copy, or undefined when the field is absent.
 * @throws {TypeError} When a present authorization has no usable kind.
 */
function captureAuthorization(
  layerName: ServiceAccessLayerName,
  descriptor: PropertyDescriptor | undefined,
): Authorization | undefined {
  if (descriptor === undefined) {
    return undefined;
  }
  if (!isDataDescriptor(descriptor) || !isAuthorizationValue(descriptor.value)) {
    throw invalidLayer(layerName);
  }

  let propertyDescriptors: Record<string, PropertyDescriptor>;
  try {
    // Read descriptors rather than enumerating values so an accessor cannot
    // supply or conceal credential material during the copy.
    propertyDescriptors = Object.getOwnPropertyDescriptors(descriptor.value);
  } catch {
    throw invalidLayer(layerName);
  }

  const kindDescriptor = propertyDescriptors.kind;
  if (
    kindDescriptor === undefined ||
    !isDataDescriptor(kindDescriptor) ||
    !isOpenIdentifier(kindDescriptor.value)
  ) {
    throw invalidLayer(layerName);
  }

  // Start from the required discriminator so the copy satisfies Authorization
  // without asserting a generic record into that interface.
  const copy: Authorization = { kind: kindDescriptor.value };
  for (const [key, propertyDescriptor] of Object.entries(propertyDescriptors)) {
    // Skip accessors and non-enumerable slots. Scheme data must already be an
    // ordinary enumerable field; hidden state is not part of the description.
    if (
      key === "kind" ||
      !isDataDescriptor(propertyDescriptor) ||
      propertyDescriptor.enumerable !== true
    ) {
      continue;
    }
    Object.defineProperty(copy, key, {
      configurable: false,
      enumerable: true,
      value: propertyDescriptor.value,
      writable: false,
    });
  }

  return Object.freeze(copy);
}

/**
 * Copies ordered header occurrences, retaining only name and value.
 *
 * @param layerName Layer role reported when a header descriptor drifts.
 * @param descriptor Own headers descriptor.
 * @returns A frozen array of frozen header occurrences.
 * @throws {TypeError} When the collection is no longer a valid header list.
 */
function captureHeaders(
  layerName: ServiceAccessLayerName,
  descriptor: PropertyDescriptor | undefined,
): HeaderFields {
  return captureOccurrences(layerName, descriptor, (element): HeaderField => {
    if (!isOwnString(element, "name") || !isOwnString(element, "value")) {
      throw invalidLayer(layerName);
    }
    return Object.freeze({
      name: readOwnString(element, "name"),
      value: readOwnString(element, "value"),
    });
  });
}

/**
 * Copies ordered query occurrences, retaining only name and value.
 *
 * @param layerName Layer role reported when a query descriptor drifts.
 * @param descriptor Own query descriptor.
 * @returns A frozen array of frozen query occurrences.
 * @throws {TypeError} When the collection is no longer a valid query list.
 */
function captureQuery(
  layerName: ServiceAccessLayerName,
  descriptor: PropertyDescriptor | undefined,
): QueryFields {
  return captureOccurrences(layerName, descriptor, (element): QueryField => {
    if (!isOwnString(element, "name") || !isOwnString(element, "value")) {
      throw invalidLayer(layerName);
    }
    return Object.freeze({
      name: readOwnString(element, "name"),
      value: readOwnString(element, "value"),
    });
  });
}

/**
 * Copies a dense occurrence array by index without using its iterator.
 *
 * @param layerName Layer role reported when reflection fails.
 * @param descriptor Own collection descriptor.
 * @param copyElement Copies one validated element into a detached object.
 * @returns A frozen dense array.
 * @throws {TypeError} When the collection shape changes after validation.
 */
function captureOccurrences<T>(
  layerName: ServiceAccessLayerName,
  descriptor: PropertyDescriptor | undefined,
  copyElement: (element: object) => T,
): readonly T[] {
  if (!isDataDescriptor(descriptor) || !Array.isArray(descriptor.value)) {
    throw invalidLayer(layerName);
  }

  const elements: T[] = [];
  for (let index = 0; index < descriptor.value.length; index += 1) {
    let elementDescriptor: PropertyDescriptor | undefined;
    try {
      elementDescriptor = Object.getOwnPropertyDescriptor(descriptor.value, String(index));
    } catch {
      throw invalidLayer(layerName);
    }
    if (!isDataDescriptor(elementDescriptor) || !isNamedObject(elementDescriptor.value)) {
      throw invalidLayer(layerName);
    }
    elements.push(copyElement(elementDescriptor.value));
  }
  return Object.freeze(elements);
}

/**
 * Copies extension membership without assigning dynamic keys.
 *
 * @param layerName Layer role reported when extension data drifts.
 * @param descriptor Own extensions descriptor.
 * @returns A frozen JSON object detached from the source.
 * @throws {TypeError} When an extension member is no longer JSON data.
 */
function captureExtensions(
  layerName: ServiceAccessLayerName,
  descriptor: PropertyDescriptor | undefined,
): Extensions {
  if (!isDataDescriptor(descriptor) || !isNamedObject(descriptor.value)) {
    throw invalidLayer(layerName);
  }

  // A null prototype prevents a copied `__proto__` member from changing the
  // result's prototype during ordinary property definition.
  const copy: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
  for (const [key, propertyValue] of readEnumerableStringData(layerName, descriptor.value)) {
    Object.defineProperty(copy, key, {
      configurable: false,
      enumerable: true,
      value: cloneJsonValue(layerName, propertyValue),
      writable: false,
    });
  }
  return Object.freeze(copy);
}

/**
 * Clones one JSON value into frozen storage.
 *
 * @param layerName Layer role reported when a nested value is not JSON.
 * @param value Candidate JSON value captured from an own data descriptor.
 * @returns A frozen clone when the value is an object or array.
 * @throws {TypeError} When the value is not finite JSON data.
 */
function cloneJsonValue(layerName: ServiceAccessLayerName, value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    // Reject the non-portable numeric forms that the JSON validator also rejects,
    // in case the source changes between the earlier predicate and this copy.
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw invalidLayer(layerName);
    }
    return value;
  }
  if (Array.isArray(value)) {
    const elements: JsonValue[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const elementDescriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!isDataDescriptor(elementDescriptor)) {
        throw invalidLayer(layerName);
      }
      elements.push(cloneJsonValue(layerName, elementDescriptor.value));
    }
    return Object.freeze(elements);
  }
  if (!isNamedObject(value)) {
    throw invalidLayer(layerName);
  }

  const copy: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
  for (const [key, propertyValue] of readEnumerableStringData(layerName, value)) {
    Object.defineProperty(copy, key, {
      configurable: false,
      enumerable: true,
      value: cloneJsonValue(layerName, propertyValue),
      writable: false,
    });
  }
  return Object.freeze(copy);
}

/**
 * Reads enumerable string data properties, rejecting hidden or symbolic keys.
 *
 * @param layerName Layer role reported when reflection or key shape fails.
 * @param value JSON object whose own properties are copied.
 * @returns Entries in reflection order.
 * @throws {TypeError} When a key is a symbol, an accessor, or non-enumerable.
 */
function readEnumerableStringData(
  layerName: ServiceAccessLayerName,
  value: object,
): readonly (readonly [string, unknown])[] {
  let keys: readonly PropertyKey[];
  try {
    // Include symbol keys so they fail closed instead of disappearing from the
    // snapshot. String keys such as `__proto__` stay ordinary property names.
    keys = Reflect.ownKeys(value);
  } catch {
    throw invalidLayer(layerName);
  }

  const entries: (readonly [string, unknown])[] = [];
  for (const key of keys) {
    if (typeof key !== "string") {
      throw invalidLayer(layerName);
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      throw invalidLayer(layerName);
    }
    if (!isDataDescriptor(descriptor) || descriptor.enumerable !== true) {
      throw invalidLayer(layerName);
    }
    entries.push([key, descriptor.value]);
  }
  return entries;
}

/**
 * Copies an optional own string without treating an empty string as omission.
 *
 * @param layerName Layer role reported when the descriptor is not string data.
 * @param descriptor Own property descriptor, if the field exists.
 * @returns The captured string, or undefined when the property is absent.
 * @throws {TypeError} When a present property is not a string data field.
 */
function captureOptionalString(
  layerName: ServiceAccessLayerName,
  descriptor: PropertyDescriptor | undefined,
): string | undefined {
  if (descriptor === undefined) {
    return undefined;
  }
  if (!isDataDescriptor(descriptor) || typeof descriptor.value !== "string") {
    throw invalidLayer(layerName);
  }
  return descriptor.value;
}

/**
 * Selects the highest-priority explicit scalar value.
 *
 * @param layers Layer snapshots in precedence order, with omitted layers absent.
 * @param field Scalar field whose presence is independent of other fields.
 * @returns The first present value, or undefined when every layer omitted it.
 */
function firstPresent<
  Field extends "endpoint" | "authorization" | "apiVersion" | "projectId" | "tenantId",
>(
  layers: readonly (ServiceAccessLayerSnapshot | undefined)[],
  field: Field,
): ServiceAccessLayerSnapshot[Field] | undefined {
  for (const layer of layers) {
    if (layer !== undefined && layer[field] !== undefined) {
      return layer[field];
    }
  }
  return undefined;
}

/**
 * Selects the highest-priority non-empty occurrence list.
 *
 * @param layers Layer snapshots in precedence order.
 * @param field Header or query collection.
 * @returns The winning frozen collection, or a new empty collection.
 */
function firstExplicitCollection(
  layers: readonly (ServiceAccessLayerSnapshot | undefined)[],
  field: "headers",
): HeaderFields;
function firstExplicitCollection(
  layers: readonly (ServiceAccessLayerSnapshot | undefined)[],
  field: "query",
): QueryFields;
function firstExplicitCollection(
  layers: readonly (ServiceAccessLayerSnapshot | undefined)[],
  field: "headers" | "query",
): HeaderFields | QueryFields {
  for (const layer of layers) {
    if (layer !== undefined && layer[field].length > 0) {
      return layer[field];
    }
  }
  return Object.freeze([]);
}

/**
 * Selects the highest-priority extension map that contains at least one key.
 *
 * @param layers Layer snapshots in precedence order.
 * @returns The winning frozen map, or a new empty map.
 */
function firstExplicitExtensions(
  layers: readonly (ServiceAccessLayerSnapshot | undefined)[],
): Extensions {
  for (const layer of layers) {
    if (layer !== undefined && Object.keys(layer.extensions).length > 0) {
      return layer.extensions;
    }
  }
  return Object.freeze(Object.create(null) as Record<string, JsonValue>);
}

/**
 * Reports access that cannot satisfy the resolved execution contract.
 *
 * @param missingEndpoint Whether every layer omitted the endpoint.
 * @param missingAuthorization Whether every layer omitted authorization.
 * @returns A classified error whose details name only the missing fields.
 */
function createIncompleteServiceAccessError(
  missingEndpoint: boolean,
  missingAuthorization: boolean,
): ModelInteractionError {
  // Boolean flags avoid copying any endpoint, header, query, or authorization
  // value from the layers that were successfully supplied.
  return new ModelInteractionError({
    message: "Service access resolution requires an absolute endpoint and an authorization.",
    category: "invalid_request",
    phase: "resolution",
    code: SERVICE_ACCESS_INCOMPLETE_CODE,
    diagnostics: [
      {
        code: SERVICE_ACCESS_INCOMPLETE_CODE,
        severity: "error",
        phase: "resolution",
        message: "Resolved service access is missing a required field.",
        details: {
          missingEndpoint,
          missingAuthorization,
        },
      },
    ],
  });
}

/**
 * Creates the stable failure for one invalid configuration layer.
 *
 * @param layerName Precedence role that failed validation.
 * @returns An error that identifies the role and no caller-supplied data.
 */
function invalidLayer(layerName: ServiceAccessLayerName): TypeError {
  return new TypeError(invalidLayerMessage(layerName));
}

/**
 * Returns the stable message for one invalid configuration layer.
 *
 * @param layerName Precedence role that failed validation.
 * @returns Message text shared by construction and rethrow matching.
 */
function invalidLayerMessage(layerName: ServiceAccessLayerName): string {
  return `${layerName} must be a valid service access value.`;
}

/**
 * Checks that a descriptor stores a value rather than invoking an accessor.
 *
 * @param descriptor Property descriptor to inspect.
 * @returns Whether the descriptor contains a data value.
 */
function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { readonly value: unknown } {
  return descriptor !== undefined && "value" in descriptor;
}

/**
 * Determines whether a value is a non-array object.
 *
 * @param value Candidate value.
 * @returns Whether named own properties can be read from the value.
 */
function isNamedObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Determines whether an authorization value has an own string kind.
 *
 * @param value Candidate authorization value.
 * @returns Whether the value can be considered for an atomic copy.
 */
function isAuthorizationValue(value: unknown): value is Authorization {
  return (
    isNamedObject(value) &&
    isOwnString(value, "kind") &&
    isOpenIdentifier(readOwnString(value, "kind"))
  );
}

/**
 * Reads one own data string without accepting inherited or accessor fields.
 *
 * @param value Object whose own property is required.
 * @param key Property name to read.
 * @returns Whether the property stores a string.
 */
function isOwnString(value: object, key: string): boolean {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return isDataDescriptor(descriptor) && typeof descriptor.value === "string";
  } catch {
    return false;
  }
}

/**
 * Reads an own string that the caller has already validated.
 *
 * @param value Object containing the property.
 * @param key Property name to read.
 * @returns The stored string.
 */
function readOwnString(value: object, key: string): string {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!isDataDescriptor(descriptor) || typeof descriptor.value !== "string") {
    // The caller checks the same condition first. Repeating it keeps the read
    // path free of a non-null assertion if a proxy changes the property.
    throw new TypeError("Expected an own string data property.");
  }
  return descriptor.value;
}

/**
 * Checks one own data property for an exact string value.
 *
 * @param value Object to inspect.
 * @param key Property name to compare.
 * @param expected Required string value.
 * @returns Whether the own data property equals the expected value.
 */
function isDataValue(value: object, key: string, expected: string): boolean {
  return isOwnString(value, key) && readOwnString(value, key) === expected;
}
