// Copyright © 2026 Mcont.

import {
  ModelInteractionError,
  type HeaderField,
  type HeaderFields,
} from "@evolutos/mconet-core-domain";

/**
 * Lowercase HTTP field-name token.
 *
 * This is the same name form required before a header enters service access.
 * The mapper does not lowercase or otherwise rewrite a name that misses it.
 */
const NORMALIZED_HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9a-z]+$/u;

/** Characters that can inject another header or are rejected by Fetch. */
const FORBIDDEN_HEADER_VALUE_CHARACTER = /[\0\r\n]/u;

/** Stable code for a header the Fetch transport will not send. */
const INVALID_FETCH_HEADER_CODE = "invalid_fetch_header";

/**
 * One header occurrence ready for a Fetch request.
 *
 * Repeated names stay as separate entries in caller order. The value is copied
 * verbatim and is not joined with another occurrence of the same name.
 */
export interface FetchHeaderField {
  /** Lowercase field name. */
  readonly name: string;

  /** Field value, unchanged apart from being rejected when it is unsafe. */
  readonly value: string;
}

/**
 * Maps ordered header occurrences to Fetch request fields.
 *
 * Duplicate names and their relative order are preserved. Names must already
 * be lowercase tokens, and values must not contain NUL, CR, or LF. The
 * function does not drop browser-forbidden names, add authorization, or create
 * a platform `Headers` object.
 *
 * @param headers Ordered header occurrences from the transport request.
 * @returns Frozen occurrences safe to pass to Fetch later.
 * @throws {ModelInteractionError} When a name or value cannot be sent safely.
 */
export function mapFetchHeaders(headers: HeaderFields): readonly FetchHeaderField[] {
  if (!Array.isArray(headers)) {
    throw createInvalidFetchHeaderError();
  }

  const mapped: FetchHeaderField[] = [];
  for (let index = 0; index < headers.length; index += 1) {
    // A hole is not an empty header. Indexed access also rejects a sparse array
    // that `for...of` would silently skip.
    if (!Object.hasOwn(headers, index)) {
      throw createInvalidFetchHeaderError();
    }

    const header = headers[index];
    if (!isMappableHeader(header)) {
      throw createInvalidFetchHeaderError();
    }

    mapped.push(
      Object.freeze({
        name: header.name,
        value: header.value,
      }),
    );
  }

  return Object.freeze(mapped);
}

/**
 * Checks one occurrence against the Fetch header token and injection rules.
 *
 * @param header Candidate occurrence from the input array.
 * @returns Whether the name and value can be copied unchanged.
 */
function isMappableHeader(header: HeaderField | undefined): header is HeaderField {
  if (header === undefined || typeof header.name !== "string" || typeof header.value !== "string") {
    return false;
  }

  return (
    NORMALIZED_HEADER_NAME.test(header.name) && !FORBIDDEN_HEADER_VALUE_CHARACTER.test(header.value)
  );
}

/**
 * Creates the content-safe failure for one unusable header.
 *
 * Names and values are omitted because either can carry authorization material
 * or injected header text.
 *
 * @returns Transport error that does not include the rejected header.
 */
function createInvalidFetchHeaderError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Fetch header cannot be sent.",
    category: "invalid_request",
    phase: "transport",
    code: INVALID_FETCH_HEADER_CODE,
    diagnostics: [],
  });
}
