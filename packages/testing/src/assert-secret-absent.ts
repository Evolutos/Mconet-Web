// Copyright © 2026 Mcont.

/** Stable leak diagnostic that never includes the detected plaintext. */
const secretLeakMessage = "Secret detected in an inspected carrier.";

/** Stable unsupported-carrier diagnostic prefix. */
const unsupportedCarrierMessage = "Secret scan cannot inspect carrier data";

/** Shared native accessor used by this Node runtime to materialize Error stacks. */
const nativeErrorStackGetter = Object.getOwnPropertyDescriptor(new Error(), "stack")?.get;

/**
 * Asserts that known plaintext is absent from every supplied runtime carrier.
 *
 * The assertion recursively inspects strings, binary views, arrays, plain
 * records, Error data, Map and Set entries, URLs, and URLSearchParams without
 * invoking user-defined accessors. Unsupported or unreadable data fails closed
 * instead of being silently skipped. Diagnostics identify only a structural
 * location and never include the secret or a carrier value.
 *
 * @param secret Exact non-empty plaintext whose disclosure must be detected.
 * @param carriers Runtime values that may carry observable output.
 * @throws {TypeError} When input is invalid or a carrier cannot be inspected safely.
 * @throws {Error} When the plaintext occurs in any supported carrier.
 */
export function assertSecretAbsent(secret: string, ...carriers: readonly unknown[]): void {
  // Validate the runtime boundary because JavaScript tests can call this helper
  // without the protection of its TypeScript declaration.
  if (typeof secret !== "string" || secret.length === 0) {
    throw new TypeError("Secret must be a non-empty string.");
  }
  if (carriers.length === 0) {
    throw new TypeError("At least one carrier must be provided for secret scanning.");
  }

  // Encode once for exact byte-subsequence checks and share one visited set so
  // repeated or cyclic object references cannot cause unbounded traversal.
  const secretBytes = new TextEncoder().encode(secret);
  const visitedObjects = new WeakSet<object>();

  for (let index = 0; index < carriers.length; index += 1) {
    scanCarrier(carriers[index], secret, secretBytes, visitedObjects, `carrier[${index}]`);
  }
}

/**
 * Recursively inspects one supported carrier value.
 *
 * @param value Current runtime value.
 * @param secret Exact plaintext being protected.
 * @param secretBytes UTF-8 representation used for binary carriers.
 * @param visitedObjects Objects already traversed by this assertion call.
 * @param location Redacted structural location for safe diagnostics.
 */
function scanCarrier(
  value: unknown,
  secret: string,
  secretBytes: Uint8Array,
  visitedObjects: WeakSet<object>,
  location: string,
): void {
  // Strings are the primary observable carrier for headers, logs, diagnostics,
  // serialized snapshots, and error fields.
  if (typeof value === "string") {
    assertStringDoesNotContainSecret(value, secret, location);
    return;
  }

  // Symbol descriptions can appear in inspection output even though symbols are
  // not JSON values, so scan the description when one is present.
  if (typeof value === "symbol") {
    if (value.description !== undefined) {
      assertStringDoesNotContainSecret(value.description, secret, location);
    }
    return;
  }

  // Null and non-string scalar values cannot contain a string plaintext. A
  // function is executable and cannot be inspected without reading source text,
  // so reject it rather than invoking or stringifying it.
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    return;
  }
  if (typeof value === "function") {
    throw unsupportedCarrier(location, "functions are not inspectable data");
  }

  // A repeated reference was fully scanned on its first encounter. Mark before
  // descending so ordinary cycles terminate without hiding reachable values.
  if (visitedObjects.has(value)) {
    return;
  }
  visitedObjects.add(value);

  // Typed arrays, DataView, and Node Buffer all expose a bounded view into an
  // ArrayBuffer; scan only the view's visible byte range.
  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    assertBytesDoNotContainSecret(bytes, secretBytes, location);
    return;
  }
  if (value instanceof ArrayBuffer) {
    assertBytesDoNotContainSecret(new Uint8Array(value), secretBytes, location);
    return;
  }

  // Platform URL containers have stable built-in textual forms. Inspect those
  // forms directly because their relevant state is stored in internal slots.
  if (value instanceof URL) {
    scanUrl(value, secret, location);
    return;
  }
  if (value instanceof URLSearchParams) {
    scanUrlSearchParams(value, secret, location);
    return;
  }

  if (value instanceof Error) {
    // Standard message, stack, cause, and custom Error data are own descriptors.
    // Reading them through the shared helper includes non-enumerable fields while
    // refusing user-defined accessors.
    scanOwnDataProperties(value, secret, secretBytes, visitedObjects, location);
    return;
  }

  if (value instanceof Map) {
    // Map keys can leak as readily as values during inspection or logging, so
    // scan both sides of every entry using ordinal-only diagnostic paths.
    let entries: readonly (readonly [unknown, unknown])[];
    try {
      // Materialize built-in entries before scanning so iterator failures cannot
      // expose arbitrary thrown values through this assertion.
      entries = [...value.entries()];
    } catch {
      throw unsupportedCarrier(location, "Map entries are unreadable");
    }
    for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
      const entry = entries[entryIndex];
      if (!entry) {
        throw unsupportedCarrier(location, "Map entry enumeration was inconsistent");
      }
      const [key, entryValue] = entry;
      scanCarrier(key, secret, secretBytes, visitedObjects, `${location}.mapKey[${entryIndex}]`);
      scanCarrier(
        entryValue,
        secret,
        secretBytes,
        visitedObjects,
        `${location}.mapValue[${entryIndex}]`,
      );
    }
    scanOwnDataProperties(value, secret, secretBytes, visitedObjects, location);
    return;
  }

  if (value instanceof Set) {
    // Preserve no element text in diagnostics; a stable ordinal is sufficient
    // to locate the leaking value in test setup.
    let entries: readonly unknown[];
    try {
      // Copy references only; no value coercion occurs while the built-in iterator
      // is isolated from the later recursive scan.
      entries = [...value.values()];
    } catch {
      throw unsupportedCarrier(location, "Set entries are unreadable");
    }
    for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
      scanCarrier(
        entries[entryIndex],
        secret,
        secretBytes,
        visitedObjects,
        `${location}.setValue[${entryIndex}]`,
      );
    }
    scanOwnDataProperties(value, secret, secretBytes, visitedObjects, location);
    return;
  }

  // Arrays and ordinary records are the data shapes used by headers, snapshots,
  // monitor events, and structured logs. Reject platform or class instances that
  // would require invoking custom behavior to reveal internal state.
  const prototype = readPrototype(value, location);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw unsupportedCarrier(location, "object prototype is not a plain data container");
  }
  scanOwnDataProperties(value, secret, secretBytes, visitedObjects, location);
}

/**
 * Inspects all own data properties without evaluating getters.
 *
 * @param value Object whose own keys and values are observable carrier data.
 * @param secret Exact plaintext being protected.
 * @param secretBytes UTF-8 representation used for binary carriers.
 * @param visitedObjects Objects already traversed by this assertion call.
 * @param location Redacted structural location for safe diagnostics.
 */
function scanOwnDataProperties(
  value: object,
  secret: string,
  secretBytes: Uint8Array,
  visitedObjects: WeakSet<object>,
  location: string,
): void {
  let keys: readonly PropertyKey[];
  try {
    // Reflect includes non-enumerable and symbol keys that object inspection may
    // expose, while descriptor access below avoids executing getters.
    keys = Reflect.ownKeys(value);
  } catch {
    // Do not attach a caller-controlled thrown value as cause because that value
    // could itself contain the plaintext this assertion protects.
    throw unsupportedCarrier(location, "own keys are unreadable");
  }

  for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
    const key = keys[keyIndex];
    if (key === undefined) {
      // noUncheckedIndexedAccess requires a guard even though the loop bounds
      // guarantee that Reflect.ownKeys supplied an entry at this index.
      throw unsupportedCarrier(location, "own-key enumeration was inconsistent");
    }

    const propertyLocation = `${location}.property[${keyIndex}]`;
    // Reflect currently returns string or symbol keys, while PropertyKey also
    // permits numeric input; explicit primitive conversion keeps the helper
    // correct under either declaration without invoking carrier behavior.
    const keyText = typeof key === "symbol" ? key.description : String(key);
    if (keyText !== undefined) {
      assertStringDoesNotContainSecret(keyText, secret, `${propertyLocation}.name`);
    }

    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      // Fail with implementation-owned text only; a Proxy trap may throw a
      // secret-bearing value that must not be retained as cause.
      throw unsupportedCarrier(propertyLocation, "descriptor is unreadable");
    }

    // A disappearing property indicates a Proxy or concurrent mutation, and an
    // accessor cannot be inspected without executing caller-controlled code.
    if (!descriptor) {
      throw unsupportedCarrier(propertyLocation, "property disappeared during inspection");
    }
    if (!("value" in descriptor)) {
      // Current Node versions expose Error.stack through one shared native
      // accessor. Invoke only that exact platform function; caller-defined
      // accessors remain forbidden and are never executed.
      if (
        value instanceof Error &&
        key === "stack" &&
        descriptor.get !== undefined &&
        descriptor.get === nativeErrorStackGetter
      ) {
        let stackValue: unknown;
        try {
          stackValue = descriptor.get.call(value);
        } catch {
          throw unsupportedCarrier(propertyLocation, "native Error stack is unreadable");
        }
        scanCarrier(stackValue, secret, secretBytes, visitedObjects, `${propertyLocation}.value`);
        continue;
      }
      throw unsupportedCarrier(propertyLocation, "accessor-backed values are not inspectable");
    }

    scanCarrier(descriptor.value, secret, secretBytes, visitedObjects, `${propertyLocation}.value`);
  }
}

/**
 * Reads an object prototype while converting Proxy failures to a safe diagnostic.
 *
 * @param value Object whose data-container shape is being classified.
 * @param location Redacted structural location for safe diagnostics.
 * @returns The object's prototype.
 */
function readPrototype(value: object, location: string): object | null {
  try {
    // Prototype identity distinguishes plain records from class instances whose
    // meaningful state may be hidden in inaccessible internal slots.
    return Object.getPrototypeOf(value) as object | null;
  } catch {
    // A Proxy may throw arbitrary secret-bearing data, so discard it and retain
    // only the safe structural location.
    throw unsupportedCarrier(location, "prototype is unreadable");
  }
}

/**
 * Inspects one URL including decoded components and decoded query entries.
 *
 * @param value URL carrier backed by platform internal slots.
 * @param secret Exact plaintext being protected.
 * @param location Redacted structural location for safe diagnostics.
 */
function scanUrl(value: URL, secret: string, location: string): void {
  let href: string;
  let username: string;
  let password: string;
  let pathname: string;
  let hash: string;
  let searchParameters: URLSearchParams;
  try {
    // Read internal-slot-backed values without yet producing assertion failures,
    // so platform or Proxy exceptions can be replaced with safe diagnostics.
    href = value.href;
    username = decodeUrlComponent(value.username, `${location}.urlUsername`);
    password = decodeUrlComponent(value.password, `${location}.urlPassword`);
    pathname = decodeUrlComponent(value.pathname, `${location}.urlPathname`);
    hash = decodeUrlComponent(value.hash, `${location}.urlHash`);
    searchParameters = value.searchParams;
  } catch {
    throw unsupportedCarrier(location, "URL data is unreadable");
  }

  // Raw href covers visible serialization; decoded components catch credentials
  // hidden only by percent encoding in user-info, paths, or fragments.
  assertStringDoesNotContainSecret(href, secret, `${location}.urlHref`);
  assertStringDoesNotContainSecret(username, secret, `${location}.urlUsername`);
  assertStringDoesNotContainSecret(password, secret, `${location}.urlPassword`);
  assertStringDoesNotContainSecret(pathname, secret, `${location}.urlPathname`);
  assertStringDoesNotContainSecret(hash, secret, `${location}.urlHash`);
  scanUrlSearchParams(searchParameters, secret, `${location}.urlSearchParams`);
}

/**
 * Inspects URLSearchParams through raw serialization and decoded entries.
 *
 * @param value Search-parameter carrier backed by platform internal slots.
 * @param secret Exact plaintext being protected.
 * @param location Redacted structural location for safe diagnostics.
 */
function scanUrlSearchParams(value: URLSearchParams, secret: string, location: string): void {
  let serializedValue: string;
  let entries: readonly (readonly [string, string])[];
  try {
    // toString covers the externally serialized form, while entries expose decoded
    // names and values so percent encoding cannot hide the known plaintext.
    serializedValue = value.toString();
    entries = [...value.entries()];
  } catch {
    throw unsupportedCarrier(location, "URL search parameters are unreadable");
  }

  assertStringDoesNotContainSecret(serializedValue, secret, `${location}.serialized`);
  for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
    const entry = entries[entryIndex];
    if (!entry) {
      throw unsupportedCarrier(location, "URL parameter enumeration was inconsistent");
    }
    assertStringDoesNotContainSecret(entry[0], secret, `${location}.name[${entryIndex}]`);
    assertStringDoesNotContainSecret(entry[1], secret, `${location}.value[${entryIndex}]`);
  }
}

/**
 * Decodes one URL component without leaking decoder diagnostics.
 *
 * @param value Raw percent-encoded URL component.
 * @param location Redacted structural location for safe diagnostics.
 * @returns Decoded URL component text.
 */
function decodeUrlComponent(value: string, location: string): string {
  try {
    // URL fields retain percent escapes; explicit decoding reveals the text a
    // consumer would recover before using a credential-bearing component.
    return decodeURIComponent(value);
  } catch {
    throw unsupportedCarrier(location, "URL component cannot be decoded");
  }
}

/**
 * Rejects one string containing the protected plaintext.
 *
 * @param value Observable string carrier.
 * @param secret Exact plaintext being protected.
 * @param location Redacted structural location for safe diagnostics.
 */
function assertStringDoesNotContainSecret(value: string, secret: string, location: string): void {
  // Use exact substring matching because the caller knows the credential value;
  // heuristic shape detection belongs to the separate repository scanner.
  if (value.includes(secret)) {
    throw new Error(`${secretLeakMessage} Location: ${location}.`);
  }
}

/**
 * Rejects one byte carrier containing the exact UTF-8 secret sequence.
 *
 * @param bytes Observable byte range.
 * @param secretBytes Non-empty UTF-8 plaintext sequence.
 * @param location Redacted structural location for safe diagnostics.
 */
function assertBytesDoNotContainSecret(
  bytes: Uint8Array,
  secretBytes: Uint8Array,
  location: string,
): void {
  // Search raw bytes instead of decoding an arbitrary body, so invalid UTF-8
  // around an otherwise exact secret sequence cannot hide a disclosure.
  const lastStartIndex = bytes.length - secretBytes.length;
  for (let startIndex = 0; startIndex <= lastStartIndex; startIndex += 1) {
    let matches = true;
    for (let offset = 0; offset < secretBytes.length; offset += 1) {
      if (bytes[startIndex + offset] !== secretBytes[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      throw new Error(`${secretLeakMessage} Location: ${location}.`);
    }
  }
}

/**
 * Creates a fail-closed error without including carrier values or property names.
 *
 * @param location Redacted structural location for safe diagnostics.
 * @param reason Stable reason describing why inspection is unsafe.
 * @returns TypeError suitable for immediate assertion failure.
 */
function unsupportedCarrier(location: string, reason: string): TypeError {
  // Both inputs are implementation-controlled structural text; no secret or
  // arbitrary carrier representation is interpolated into the error.
  return new TypeError(`${unsupportedCarrierMessage} at ${location}: ${reason}.`);
}
