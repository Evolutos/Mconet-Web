// Copyright © 2026 Mcont.

import { ModelInteractionError, type OpenIdentifier } from "@evolutos/mconet-core-domain";
import type {
  Transport,
  TransportContext,
  TransportRequest,
  TransportResponse,
} from "@evolutos/mconet-core-spi";
import {
  bridgeCallerAbortSignal,
  bridgeDeadlineSignal,
  mapFetchAbortError,
  mapFetchBaseUrl,
  mapFetchBody,
  mapFetchHeaders,
  mapFetchHttpMethod,
  mapFetchNetworkError,
  mapFetchResponseMediaType,
  mapFetchStatus,
  readBoundedFetchResponseBody,
} from "@evolutos/mconet-transport-fetch-shared";

import { assertBrowserRequestHeaders } from "./browser-forbidden-headers.js";
import { resolveBrowserCredentials } from "./browser-credentials-policy.js";
import { readVisibleBrowserResponseHeaders } from "./read-visible-browser-response-headers.js";
import { resolveBrowserRedirect } from "./browser-redirect-policy.js";
import {
  resolveBrowserReferrerPolicy,
  type BrowserReferrerPolicy,
} from "./browser-referrer-policy.js";
import type {
  BrowserFetch,
  BrowserFetchCredentials,
  BrowserFetchRedirect,
  BrowserFetchTransportOptions,
} from "./browser-fetch-transport-options.js";

/** Stable code for a browser transport constructed without a Fetch function. */
const MISSING_FETCH_CODE = "missing_fetch";

/** Stable code for a request that still carries unordered query fields. */
const UNSUPPORTED_FETCH_QUERY_CODE = "unsupported_fetch_query";

/** Descriptive identity shared by every browser Fetch transport instance. */
const BROWSER_FETCH_TRANSPORT_DESCRIPTOR: Transport["descriptor"] = Object.freeze({
  name: "browser-fetch-transport",
  version: "0.0.0",
  capabilities: new Set<OpenIdentifier>(),
  source: "builtin",
});

/**
 * Global object that provides the platform Fetch function.
 *
 * Window and Worker expose `fetch` on their own global. The lookup reads that
 * property and does not consult `window`, `document`, or `self`.
 */
export interface BrowserFetchRealm {
  /** Platform Fetch function visible in this realm, when present. */
  readonly fetch?: BrowserFetch;
}

/**
 * Browser transport bound to one Fetch function.
 *
 * An explicit function is stored by reference. When it is omitted, construction
 * reads `fetch` from the current global object once. The credential mode
 * defaults to `omit`, the redirect mode defaults to `error`, and the referrer
 * policy is `no-referrer`. Construction does not call Fetch.
 */
export class BrowserFetchTransport implements Transport {
  /** Descriptive component facts. The instance adds no request state. */
  public readonly descriptor: Transport["descriptor"] = BROWSER_FETCH_TRANSPORT_DESCRIPTOR;

  /** Fetch function bound to this instance. */
  readonly #fetch: BrowserFetch;

  /** Credential mode this instance passes to Fetch. */
  readonly #credentials: BrowserFetchCredentials;

  /** Redirect mode this instance passes to Fetch. */
  readonly #redirect: BrowserFetchRedirect;

  /** Referrer policy this instance passes to Fetch. */
  readonly #referrerPolicy: BrowserReferrerPolicy;

  /**
   * Binds an explicit Fetch function, or the current realm's Fetch function.
   *
   * @param options Browser transport settings. `fetch`, `credentials`, and `redirect` are read.
   */
  public constructor(options: BrowserFetchTransportOptions) {
    // An injected function stays intact. The realm is consulted only when the
    // caller did not supply one, and the function is not wrapped or called.
    this.#fetch = resolveBrowserFetch(options, globalThis);
    this.#credentials = resolveBrowserCredentials(options);
    this.#redirect = resolveBrowserRedirect(options);
    this.#referrerPolicy = resolveBrowserReferrerPolicy();
  }

  /**
   * Returns the credential mode this instance will pass to Fetch.
   *
   * The mode is the constructor selection. This method does not read cookies
   * or call Fetch.
   *
   * @returns Credential mode bound to this instance.
   */
  public credentials(): BrowserFetchCredentials {
    return this.#credentials;
  }

  /**
   * Returns the redirect mode this instance will pass to Fetch.
   *
   * The mode is the constructor selection. This method does not follow a
   * redirect or call Fetch.
   *
   * @returns Redirect mode bound to this instance.
   */
  public redirect(): BrowserFetchRedirect {
    return this.#redirect;
  }

  /**
   * Returns the referrer policy this instance will pass to Fetch.
   *
   * The policy is fixed at construction. This method does not read the current
   * document URL or call Fetch.
   *
   * @returns Referrer policy bound to this instance.
   */
  public referrerPolicy(): BrowserReferrerPolicy {
    return this.#referrerPolicy;
  }

  /**
   * Reports whether this instance is bound to `fetchImplementation`.
   *
   * The check is reference equality. It does not call Fetch or inspect
   * credentials, redirects, or request data.
   *
   * @param fetchImplementation Candidate Fetch function.
   * @returns Whether this instance holds that exact function.
   */
  public boundTo(fetchImplementation: BrowserFetch): boolean {
    return this.#fetch === fetchImplementation;
  }

  /**
   * Sends one encoded request through the Fetch function bound to this instance.
   *
   * Method, URL, headers, and body are validated before the call. Credentials,
   * redirect mode, and referrer policy come from construction. Query fields are
   * rejected until they can be merged in order. The caller signal and deadline
   * are bridged into one Fetch signal and released when the exchange settles.
   *
   * @param request Encoded transport request.
   * @param context Cancellation, deadline, and response-size controls.
   * @returns Buffered response bytes and the visible response metadata.
   */
  public async send(
    request: TransportRequest,
    context: TransportContext,
  ): Promise<TransportResponse> {
    const method = mapFetchHttpMethod(request.method);
    const url = mapFetchBaseUrl(request.url);

    if (request.query.length > 0) {
      throw createUnsupportedQueryError();
    }

    const headers = mapFetchHeaders(request.headers);
    assertBrowserRequestHeaders(headers);
    const body = mapFetchBody(request.body);
    const caller = bridgeCallerAbortSignal(context.signal);
    const deadline =
      context.deadline === undefined ? undefined : bridgeDeadlineSignal(context.deadline);
    const signal =
      deadline === undefined ? caller.signal : AbortSignal.any([caller.signal, deadline.signal]);

    try {
      const response = await this.#exchange(url.href, method, headers, body, signal);
      const visibleHeaders = readVisibleBrowserResponseHeaders(response.headers);
      const mediaType = mapFetchResponseMediaType(visibleHeaders);
      const responseBody = await this.#readBody(response, context.maxResponseBodyBytes, signal);

      return {
        metadata: {
          outcome: mapFetchStatus(response.status),
          headers: visibleHeaders,
          statusCode: response.status,
          extensions: {},
          ...(mediaType === undefined ? {} : { mediaType }),
        },
        body: responseBody,
      };
    } finally {
      caller.stop();
      deadline?.stop();
    }
  }

  /**
   * Calls the bound Fetch function and normalizes a rejection.
   *
   * @param href Absolute URL without a query or fragment.
   * @param method Reviewed Fetch method.
   * @param headers Mapped request headers.
   * @param body Copied request bytes. An empty body is omitted.
   * @param signal Combined cancellation and deadline signal.
   * @returns Platform response.
   */
  async #exchange(
    href: string,
    method: string,
    headers: readonly { readonly name: string; readonly value: string }[],
    body: Uint8Array,
    signal: AbortSignal,
  ): Promise<Response> {
    try {
      const init: RequestInit = {
        method,
        headers: headers.map((header): [string, string] => [header.name, header.value]),
        credentials: this.#credentials,
        redirect: this.#redirect,
        referrerPolicy: this.#referrerPolicy,
        signal,
      };

      if (body.byteLength > 0) {
        // Copy into an ArrayBuffer. A typed-array view is not a Fetch body
        // under the current DOM types, and a shared buffer must not be sent.
        const payload = new ArrayBuffer(body.byteLength);
        new Uint8Array(payload).set(body);
        init.body = payload;
      }

      return await this.#fetch(href, init);
    } catch (error) {
      if (signal.aborted) {
        throw mapFetchAbortError(signal);
      }

      throw mapFetchNetworkError(error, "request");
    }
  }

  /**
   * Reads the response body up to the caller limit.
   *
   * A limit error is preserved. An aborted signal becomes a cancellation or
   * timeout. Any other failure is a body-read network error.
   *
   * @param response Platform response.
   * @param maxResponseBodyBytes Caller byte limit.
   * @param signal Combined cancellation and deadline signal.
   * @returns Accepted response bytes.
   */
  async #readBody(
    response: Response,
    maxResponseBodyBytes: number,
    signal: AbortSignal,
  ): Promise<Uint8Array> {
    try {
      return await readBoundedFetchResponseBody(response, maxResponseBodyBytes);
    } catch (error) {
      if (error instanceof ModelInteractionError) {
        throw error;
      }

      if (signal.aborted) {
        throw mapFetchAbortError(signal);
      }

      throw mapFetchNetworkError(error, "body");
    }
  }
}

/**
 * Selects the Fetch function a browser transport binds.
 *
 * An explicit function wins. Otherwise the realm's own `fetch` is used, which
 * is the Window or Worker global when the constructor supplies `globalThis`.
 * A non-function option does not fall through to the realm.
 *
 * @param options Browser transport settings. Only `fetch` is read.
 * @param realm Realm whose `fetch` property supplies the default.
 * @returns The selected Fetch function.
 */
export function resolveBrowserFetch(
  options: BrowserFetchTransportOptions,
  realm: BrowserFetchRealm,
): BrowserFetch {
  if (typeof options.fetch === "function") {
    return options.fetch;
  }

  if (options.fetch !== undefined) {
    throw createMissingFetchError();
  }

  const realmFetch = realm.fetch;

  if (typeof realmFetch !== "function") {
    throw createMissingFetchError();
  }

  return realmFetch;
}

/**
 * Creates the error for a missing or unusable Fetch function.
 *
 * @returns Configuration error that does not include the supplied value.
 */
/**
 * Creates the error for a request that still has query fields.
 *
 * @returns Request error that does not include the query text.
 */
function createUnsupportedQueryError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Browser Fetch transport does not accept query fields.",
    category: "invalid_request",
    phase: "transport",
    code: UNSUPPORTED_FETCH_QUERY_CODE,
    diagnostics: [],
  });
}

function createMissingFetchError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Browser Fetch transport requires a fetch function.",
    category: "invalid_component_configuration",
    phase: "transport",
    code: MISSING_FETCH_CODE,
    diagnostics: [],
  });
}
