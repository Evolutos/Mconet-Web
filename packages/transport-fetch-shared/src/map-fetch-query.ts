// Copyright © 2026 Mcont.

import {
  ModelInteractionError,
  type QueryField,
  type QueryFields,
} from "@evolutos/mconet-core-domain";

import type { FetchBaseUrl } from "./map-fetch-base-url.js";

/** Characters that must not be placed into a query, even before encoding. */
const FORBIDDEN_QUERY_CHARACTER = /[\0\r\n]/u;

/** Stable code for a query the Fetch transport will not encode. */
const INVALID_FETCH_QUERY_CODE = "invalid_fetch_query";

/**
 * Host URL surface used to append an ordered query.
 *
 * The structural contract avoids depending on DOM ambient types. Only the
 * one-argument constructor is used, so a path cannot be resolved against a
 * second base.
 */
interface QueryUrl {
  /** Serialized `scheme://host` origin. */
  readonly origin: string;

  /** Absolute path, without query or fragment. */
  readonly pathname: string;

  /** Fragment including the leading `#`, or an empty string. */
  hash: string;

  /** Query including the leading `?`, or an empty string. */
  search: string;

  /** Serialized absolute URL. */
  readonly href: string;
}

/**
 * Host constructor for {@link QueryUrl}.
 */
interface QueryUrlConstructor {
  /** Parses one absolute URL string. */
  new (url: string): QueryUrl;
}

/**
 * Appends ordered query occurrences to a Fetch base address.
 *
 * Duplicate names stay in caller order. The platform query serializer encodes
 * each pair. The base address is parsed with the one-argument URL constructor,
 * and the endpoint and path are not joined by string concatenation. An empty
 * query returns the base href unchanged.
 *
 * @param base Absolute HTTP or HTTPS base address.
 * @param query Ordered query occurrences from the transport request.
 * @returns Absolute URL whose query is the encoded occurrence list.
 * @throws {ModelInteractionError} When a query occurrence cannot be encoded.
 */
export function mapFetchQuery(base: FetchBaseUrl, query: QueryFields): string {
  if (!isFetchBaseUrl(base) || !Array.isArray(query)) {
    throw createInvalidFetchQueryError();
  }

  if (query.length === 0) {
    return base.href;
  }

  const fields: QueryField[] = [];

  for (let index = 0; index < query.length; index += 1) {
    if (!Object.hasOwn(query, index)) {
      throw createInvalidFetchQueryError();
    }

    const field = query[index];
    if (!isMappableQueryField(field)) {
      throw createInvalidFetchQueryError();
    }

    fields.push(field);
  }

  const Url = (globalThis as { readonly URL?: QueryUrlConstructor }).URL;
  const Params = (globalThis as { readonly URLSearchParams?: typeof URLSearchParams })
    .URLSearchParams;

  if (Url === undefined || Params === undefined) {
    throw new Error("URL query encoding is not available in this runtime.");
  }

  let parsed: QueryUrl;

  try {
    parsed = new Url(base.href);
  } catch {
    throw createInvalidFetchQueryError();
  }

  if (`${parsed.origin}${parsed.pathname}` !== base.href || parsed.hash !== "") {
    throw createInvalidFetchQueryError();
  }

  const params = new Params();

  for (const field of fields) {
    params.append(field.name, field.value);
  }

  parsed.search = params.toString();

  if (`${parsed.origin}${parsed.pathname}` !== base.href || parsed.hash !== "") {
    throw createInvalidFetchQueryError();
  }

  return parsed.href;
}

/**
 * Checks the base address before a query is appended.
 *
 * @param value Candidate base address.
 * @returns Whether the value is a Fetch base without a query or fragment.
 */
function isFetchBaseUrl(value: unknown): value is FetchBaseUrl {
  if (value === null || typeof value !== "object") {
    return false;
  }

  if (!Object.hasOwn(value, "href")) {
    return false;
  }

  const href = (value as { readonly href?: unknown }).href;
  return typeof href === "string" && href.length > 0 && !href.includes("?") && !href.includes("#");
}

/**
 * Checks one occurrence against the query encoding rules.
 *
 * @param value Candidate query occurrence.
 * @returns Whether the name and value can be encoded as one pair.
 */
function isMappableQueryField(value: unknown): value is QueryField {
  if (value === null || typeof value !== "object") {
    return false;
  }

  if (!Object.hasOwn(value, "name") || !Object.hasOwn(value, "value")) {
    return false;
  }

  const name = (value as { readonly name?: unknown }).name;
  const fieldValue = (value as { readonly value?: unknown }).value;

  return (
    typeof name === "string" &&
    typeof fieldValue === "string" &&
    name.length > 0 &&
    !FORBIDDEN_QUERY_CHARACTER.test(name) &&
    !FORBIDDEN_QUERY_CHARACTER.test(fieldValue)
  );
}

/**
 * Creates the content-safe failure for one unusable query.
 *
 * @returns Request error that does not include the query text.
 */
function createInvalidFetchQueryError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Fetch query cannot be encoded.",
    category: "invalid_request",
    phase: "transport",
    code: INVALID_FETCH_QUERY_CODE,
    diagnostics: [],
  });
}
