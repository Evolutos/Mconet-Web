// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type { TransportBody } from "@evolutos/mconet-core-spi";

/** Stable code for a body the Fetch transport cannot send as bytes. */
const INVALID_FETCH_BODY_CODE = "invalid_fetch_body";

/**
 * Maps one transport body to a detached byte buffer for Fetch.
 *
 * Only the buffered `bytes` branch is accepted. An empty view stays an empty
 * buffer, which is a present body rather than a missing one. The returned
 * array does not share storage with the caller, so later writes to the source
 * cannot change the mapped body. The function does not encode text, add
 * headers, or start a request.
 *
 * @param body Transport body selected for this request.
 * @returns A new byte array containing the same bytes, including a zero-length body.
 * @throws {ModelInteractionError} When the body is not a buffered byte view.
 */
export function mapFetchBody(body: TransportBody): Uint8Array {
  if (!isBytesBody(body)) {
    throw createInvalidFetchBodyError();
  }

  // Copy the view rather than its underlying buffer so a partial view cannot
  // expose neighboring bytes, and a Node Buffer subclass is not retained.
  const copy = new Uint8Array(body.bytes.byteLength);
  copy.set(body.bytes);
  return copy;
}

/**
 * Narrows one value to a buffered byte body.
 *
 * @param body Candidate transport body.
 * @returns Whether `body` has the bytes branch and a real byte view.
 */
function isBytesBody(body: TransportBody): body is TransportBody & { readonly bytes: Uint8Array } {
  return (
    typeof body === "object" &&
    body !== null &&
    body.kind === "bytes" &&
    body.bytes instanceof Uint8Array
  );
}

/**
 * Creates the content-safe failure for one unusable body.
 *
 * @returns Transport error that does not include body bytes.
 */
function createInvalidFetchBodyError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Fetch body must be a buffered byte sequence.",
    category: "invalid_request",
    phase: "transport",
    code: INVALID_FETCH_BODY_CODE,
    diagnostics: [],
  });
}
