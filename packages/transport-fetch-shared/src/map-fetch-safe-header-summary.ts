// Copyright © 2026 Mcont.

import type { HeaderField, HeaderFields } from "@evolutos/mconet-core-domain";

/**
 * Response header names that may appear in a diagnostic snapshot.
 *
 * Anything outside this set stays out, including authorization, cookies, proxy
 * credentials, signatures, and unrecognized names that may carry an API key.
 */
const SAFE_RESPONSE_HEADER_NAMES: ReadonlySet<string> = new Set([
  "cache-control",
  "content-length",
  "content-type",
  "date",
  "etag",
  "request-id",
  "retry-after",
  "x-request-id",
]);

/** Characters that must not be copied into a loggable header value. */
const FORBIDDEN_SUMMARY_CHARACTER = /[\0\r\n]/u;

/**
 * Copies the reviewed safe response headers in their original order.
 *
 * Sensitive and unrecognized headers are omitted entirely, not replaced with a
 * placeholder. Repeated allowed names stay as separate occurrences. A value
 * containing NUL, CR, or LF is omitted so the snapshot cannot carry injected
 * header text. Names in the result are lowercase. This function does not read
 * a body or decide which media type to trust.
 *
 * @param headers Ordered response header occurrences visible to the caller.
 * @returns Frozen header occurrences that are safe to place in a snapshot.
 */
export function mapFetchSafeHeaderSummary(headers: HeaderFields): HeaderFields {
  if (!Array.isArray(headers)) {
    return Object.freeze([]);
  }

  const summary: HeaderField[] = [];
  for (let index = 0; index < headers.length; index += 1) {
    if (!Object.hasOwn(headers, index)) {
      continue;
    }

    const header = headers[index];
    if (!isSafeSummaryHeader(header)) {
      continue;
    }

    summary.push(
      Object.freeze({
        name: header.name.toLowerCase(),
        value: header.value,
      }),
    );
  }

  return Object.freeze(summary);
}

/**
 * Checks whether one occurrence may be copied into the summary.
 *
 * @param header Candidate response header.
 * @returns Whether its lowercase name is reviewed and its value is log-safe.
 */
function isSafeSummaryHeader(header: HeaderField | undefined): header is HeaderField {
  if (header === undefined || typeof header.name !== "string" || typeof header.value !== "string") {
    return false;
  }

  return (
    SAFE_RESPONSE_HEADER_NAMES.has(header.name.toLowerCase()) &&
    !FORBIDDEN_SUMMARY_CHARACTER.test(header.value)
  );
}
