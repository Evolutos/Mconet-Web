// Copyright © 2026 Mcont.

import { ModelInteractionError, isUriValue, type UriValue } from "@evolutos/mconet-core-domain";

/** Scheme token for an explicit local or test HTTP base address. */
const HTTP_SCHEME = "http";

/** Scheme token for a production HTTPS base address. */
const HTTPS_SCHEME = "https";

/** Protocol suffix the URL parser reports for HTTP. */
const HTTP_PROTOCOL = "http:";

/** Protocol suffix the URL parser reports for HTTPS. */
const HTTPS_PROTOCOL = "https:";

/** Delimiter that begins a query string, which this base mapper does not own. */
const QUERY_DELIMITER = "?";

/** Delimiter that begins a fragment, which Fetch must not send. */
const FRAGMENT_DELIMITER = "#";

/** Separator between a scheme and the authority the parser must preserve. */
const SCHEME_AUTHORITY_SEPARATOR = "://";

/** Stable code for a URL that is not an absolute HTTP or HTTPS base address. */
const INVALID_FETCH_URL_CODE = "invalid_fetch_url";

/**
 * Absolute HTTP or HTTPS base address accepted by Fetch.
 *
 * The fields come from the platform URL parser. Query, fragment, and user
 * information are not part of this value.
 */
export interface FetchBaseUrl {
  /** Lowercase `http` or `https` scheme without a trailing colon. */
  readonly scheme: typeof HTTP_SCHEME | typeof HTTPS_SCHEME;

  /** Parser host, including a non-default port and IPv6 brackets. */
  readonly host: string;

  /** Absolute path from the parser, always beginning with `/`. */
  readonly path: string;

  /** Serialized base address formed from the parser origin and path. */
  readonly href: string;
}

/**
 * Host URL surface used to parse one absolute address.
 *
 * The structural contract avoids depending on DOM ambient types while still
 * requiring the standard parser fields. It does not search, fetch, or resolve
 * a relative reference against a base.
 */
interface HostUrl {
  /** Lowercase scheme including the trailing colon. */
  readonly protocol: string;

  /** User name parsed from user information, or an empty string. */
  readonly username: string;

  /** Password parsed from user information, or an empty string. */
  readonly password: string;

  /** Host and non-default port, with brackets around an IPv6 address. */
  readonly host: string;

  /** Absolute path, without query or fragment. */
  readonly pathname: string;

  /** Query including the leading `?`, or an empty string. */
  readonly search: string;

  /** Fragment including the leading `#`, or an empty string. */
  readonly hash: string;

  /** Serialized `scheme://host` origin for an HTTP(S) URL. */
  readonly origin: string;
}

/**
 * Host constructor for {@link HostUrl}.
 *
 * Only the one-argument form is accepted so a relative reference cannot be
 * resolved against an implicit base.
 */
interface HostUrlConstructor {
  /** Parses one absolute URL string. */
  new (url: string): HostUrl;
}

/**
 * Maps one absolute URI reference to the HTTP or HTTPS base Fetch will use.
 *
 * The platform URL parser supplies scheme, host, and path. HTTP remains
 * available for an explicit local or test URL and is not upgraded to HTTPS.
 * User information, a query, and a fragment fail before a base is returned.
 * The function does not read headers, a body, or credentials, and it does not
 * start a request.
 *
 * @param url Absolute or relative URI reference to validate.
 * @returns Frozen base address whose href contains only scheme, host, and path.
 * @throws {ModelInteractionError} When `url` is not an absolute HTTP(S) base address.
 */
export function mapFetchBaseUrl(url: UriValue): FetchBaseUrl {
  // Relative references have no authority of their own. Reject them before the
  // parser can be given a second base argument.
  if (!isUriValue(url) || url.kind !== "absolute") {
    throw createInvalidFetchUrlError();
  }

  // Query and fragment stay outside the base address. A later query mapper owns
  // ordered query fields, and a fragment must never be sent.
  if (url.value.includes(QUERY_DELIMITER) || url.value.includes(FRAGMENT_DELIMITER)) {
    throw createInvalidFetchUrlError();
  }

  const parsed = parseAbsoluteUrl(url.value);
  if (
    parsed === undefined ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    (parsed.protocol !== HTTP_PROTOCOL && parsed.protocol !== HTTPS_PROTOCOL) ||
    parsed.host.length === 0 ||
    !parsed.pathname.startsWith("/") ||
    !url.value.toLowerCase().includes(`${SCHEME_AUTHORITY_SEPARATOR}${parsed.host.toLowerCase()}`)
  ) {
    throw createInvalidFetchUrlError();
  }

  const scheme = parsed.protocol === HTTPS_PROTOCOL ? HTTPS_SCHEME : HTTP_SCHEME;
  const href = `${parsed.origin}${parsed.pathname}`;

  // The origin must be exactly the scheme and host already checked. This rejects
  // an opaque origin or any serializer result that disagrees with those fields.
  if (parsed.origin !== `${scheme}${SCHEME_AUTHORITY_SEPARATOR}${parsed.host}`) {
    throw createInvalidFetchUrlError();
  }

  return Object.freeze({
    scheme,
    host: parsed.host,
    path: parsed.pathname,
    href,
  });
}

/**
 * Parses one absolute URL without retaining a platform exception.
 *
 * The native error can echo the input, including user information, so it is not
 * used as the public failure cause.
 *
 * @param value Absolute URL text.
 * @returns Parsed URL, or undefined when the runtime cannot parse it.
 */
function parseAbsoluteUrl(value: string): HostUrl | undefined {
  const Url = (globalThis as { readonly URL?: HostUrlConstructor }).URL;
  if (Url === undefined) {
    throw new Error("URL parsing is not available in this runtime.");
  }

  try {
    return new Url(value);
  } catch {
    return undefined;
  }
}

/**
 * Creates the content-safe failure for one unusable base address.
 *
 * @returns Transport error that does not include the rejected URL.
 */
function createInvalidFetchUrlError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Fetch URL is not an absolute HTTP or HTTPS base address.",
    category: "invalid_request",
    phase: "transport",
    code: INVALID_FETCH_URL_CODE,
    diagnostics: [],
  });
}
