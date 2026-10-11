// Copyright © 2026 Mcont.

import type { HeaderField, HeaderFields, UriValue } from "@evolutos/mconet-core-domain";
import type { TransportRequest } from "@evolutos/mconet-core-spi";

import type { SafePreAuthorizationRequestSnapshot } from "./safe-pre-authorization-request-snapshot.js";

/**
 * Request header names that may appear in a pre-authorization monitoring snapshot.
 *
 * Anything outside this set stays out. That includes authorization, proxy
 * authorization, cookies, and unrecognized names that may carry an API key.
 * The set is compared in lowercase and is not a transport allowlist.
 */
const SAFE_REQUEST_HEADER_NAMES: ReadonlySet<string> = new Set([
  "accept",
  "content-length",
  "content-type",
]);

/** Characters that must not be copied into a loggable header field. */
const forbiddenSnapshotCharacter = /[\0\r\n]/u;

/**
 * Copies the monitoring summary of a request before authorization runs.
 *
 * Authorization headers are omitted rather than masked. Query and fragment
 * text is removed from the destination. Query occurrences contribute only a
 * count, and the body contributes only its byte length. The mapper does not
 * read header values for names it will drop, mutate the request, or apply
 * authorization.
 *
 * @param request Encoded request observed before an authorization handler runs.
 * @returns A new frozen snapshot with no authorization header.
 */
export function createSafePreAuthorizationRequestSnapshot(
  request: TransportRequest,
): SafePreAuthorizationRequestSnapshot {
  return Object.freeze({
    method: request.method,
    url: snapshotUrl(request.url),
    headers: copySafeHeaders(request.headers),
    queryCount: Array.isArray(request.query) ? request.query.length : 0,
    bodyByteLength: request.body.bytes.byteLength,
  });
}

/**
 * Copies the destination without query or fragment text.
 *
 * @param url Validated request destination.
 * @returns A frozen URI value whose text stops before `?` or `#`.
 */
function snapshotUrl(url: UriValue): UriValue {
  const queryIndex = url.value.indexOf("?");
  const fragmentIndex = url.value.indexOf("#");
  let end = url.value.length;
  if (queryIndex >= 0) {
    end = Math.min(end, queryIndex);
  }
  if (fragmentIndex >= 0) {
    end = Math.min(end, fragmentIndex);
  }

  return Object.freeze({
    kind: url.kind,
    value: url.value.slice(0, end),
  });
}

/**
 * Copies allowlisted header occurrences without reading dropped values.
 *
 * @param headers Ordered request header occurrences.
 * @returns Frozen header occurrences that are safe to place in a snapshot.
 */
function copySafeHeaders(headers: HeaderFields): HeaderFields {
  if (!Array.isArray(headers)) {
    return Object.freeze([]);
  }

  const summary: HeaderField[] = [];
  for (let index = 0; index < headers.length; index += 1) {
    if (!Object.hasOwn(headers, index)) {
      continue;
    }

    const header = headers[index];
    const copied = copySafeHeader(header);
    if (copied !== undefined) {
      summary.push(copied);
    }
  }

  return Object.freeze(summary);
}

/**
 * Copies one header when its name is allowlisted and both fields are data.
 *
 * @param header Candidate request header.
 * @returns A frozen occurrence, or undefined when the header must stay out.
 */
function copySafeHeader(header: HeaderField | undefined): HeaderField | undefined {
  if (header === undefined) {
    return undefined;
  }

  const name = readDataString(header, "name");
  if (name === undefined || !SAFE_REQUEST_HEADER_NAMES.has(name.toLowerCase())) {
    return undefined;
  }
  if (forbiddenSnapshotCharacter.test(name)) {
    return undefined;
  }

  const value = readDataString(header, "value");
  if (value === undefined || forbiddenSnapshotCharacter.test(value)) {
    return undefined;
  }

  return Object.freeze({
    name: name.toLowerCase(),
    value,
  });
}

/**
 * Reads an own data string without invoking an accessor.
 *
 * @param target Object that may carry the field.
 * @param key Field name to read.
 * @returns The string value, or undefined when the field is absent or unsafe.
 */
function readDataString(target: object, key: "name" | "value"): string | undefined {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(target, key);
  } catch {
    return undefined;
  }

  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    typeof descriptor.value !== "string"
  ) {
    return undefined;
  }

  return descriptor.value;
}
