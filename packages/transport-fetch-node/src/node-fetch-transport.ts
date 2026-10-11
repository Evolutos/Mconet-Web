// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type { HeaderField, HeaderFields, OpenIdentifier } from "@evolutos/mconet-core-domain";
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

import type {
  NodeFetch,
  NodeFetchDispatcher,
  NodeFetchDispatcherOwnership,
  NodeFetchTransportOptions,
} from "./node-fetch-transport-options.js";

/** Stable code for a Node transport constructed without a Fetch function. */
const MISSING_FETCH_CODE = "missing_fetch";

/** Stable code for a request that still carries query fields. */
const UNSUPPORTED_FETCH_QUERY_CODE = "unsupported_fetch_query";

/** Descriptive identity shared by every Node Fetch transport instance. */
const NODE_FETCH_TRANSPORT_DESCRIPTOR: Transport["descriptor"] = Object.freeze({
  name: "node-fetch-transport",
  version: "0.0.0",
  capabilities: new Set<OpenIdentifier>(),
  source: "builtin",
});

/**
 * Node.js transport bound to one Fetch function.
 *
 * An explicit function is stored by reference. When it is omitted, construction
 * reads `fetch` from the current Node global once. A dispatcher is passed
 * through to Fetch and is not closed. An application-owned dispatcher stays
 * open when the transport is closed. Construction does not call Fetch.
 */
export class NodeFetchTransport implements Transport {
  /** Descriptive component facts. The instance adds no request state. */
  public readonly descriptor: Transport["descriptor"] = NODE_FETCH_TRANSPORT_DESCRIPTOR;

  /** Fetch function bound to this instance. */
  readonly #fetch: NodeFetch;

  /** Connection resource passed to Fetch, when the caller supplied one. */
  readonly #dispatcher: NodeFetchDispatcher | undefined;

  /** Who closes the dispatcher. Omitted ownership stays with the caller. */
  readonly #dispatcherOwnership: NodeFetchDispatcherOwnership | undefined;

  /**
   * Binds an explicit Fetch function, or Node's global Fetch function.
   *
   * @param options Node transport settings. Fetch, dispatcher, and ownership are read.
   */
  public constructor(options: NodeFetchTransportOptions = {}) {
    this.#fetch = resolveNodeFetch(options);
    this.#dispatcher = options.dispatcher;
    this.#dispatcherOwnership = options.dispatcherOwnership;
  }

  /**
   * Reports whether this instance is bound to `fetchImplementation`.
   *
   * The check is reference equality. It does not call Fetch or close a dispatcher.
   *
   * @param fetchImplementation Candidate Fetch function.
   * @returns Whether this instance holds that exact function.
   */
  public boundTo(fetchImplementation: NodeFetch): boolean {
    return this.#fetch === fetchImplementation;
  }

  /**
   * Leaves an application-owned dispatcher open.
   *
   * A dispatcher supplied by the caller remains the caller's resource, including
   * when ownership is omitted. This method does not call that dispatcher's
   * close function.
   *
   * @returns A settled promise. No dispatcher work is started.
   */
  public async close(): Promise<void> {
    if (this.#dispatcherOwnership === "application" || this.#dispatcherOwnership === undefined) {
      return;
    }
  }

  /**
   * Sends one encoded request through the Fetch function bound to this instance.
   *
   * Method, URL, headers, and body are validated before the call. Redirects are
   * rejected by Fetch instead of followed. Query fields are rejected until they
   * can be merged in order. The caller signal and deadline are bridged into one
   * Fetch signal and released when the exchange settles. The dispatcher is not
   * closed.
   *
   * @param request Encoded transport request.
   * @param context Cancellation, deadline, and response-size controls.
   * @returns Buffered response bytes and the response metadata.
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
    const body = mapFetchBody(request.body);
    const caller = bridgeCallerAbortSignal(context.signal);
    const deadline =
      context.deadline === undefined ? undefined : bridgeDeadlineSignal(context.deadline);
    const signal =
      deadline === undefined ? caller.signal : AbortSignal.any([caller.signal, deadline.signal]);

    try {
      const response = await this.#exchange(url.href, method, headers, body, signal);
      const responseHeaders = readNodeResponseHeaders(response.headers);
      const mediaType = mapFetchResponseMediaType(responseHeaders);
      const responseBody = await this.#readBody(response, context.maxResponseBodyBytes, signal);

      return {
        metadata: {
          outcome: mapFetchStatus(response.status),
          headers: responseHeaders,
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
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal,
      };

      if (body.byteLength > 0) {
        const payload = new ArrayBuffer(body.byteLength);
        new Uint8Array(payload).set(body);
        init.body = payload;
      }

      if (this.#dispatcher !== undefined) {
        // Node Fetch accepts a dispatcher on the request init. The public
        // options type only requires the resource to be closable, and this
        // call does not close it.
        Reflect.set(init, "dispatcher", this.#dispatcher);
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
 * Selects the Fetch function a Node transport binds.
 *
 * @param options Node transport settings. Only `fetch` is read.
 * @returns The caller-supplied function, or Node's global Fetch function.
 */
function resolveNodeFetch(options: NodeFetchTransportOptions): NodeFetch {
  if (typeof options.fetch === "function") {
    return options.fetch;
  }

  if (options.fetch !== undefined) {
    throw createMissingFetchError();
  }

  const realmFetch = globalThis.fetch;

  if (typeof realmFetch !== "function") {
    throw createMissingFetchError();
  }

  return realmFetch;
}

/**
 * Copies the response headers Node Fetch exposes.
 *
 * @param headers Platform header list.
 * @returns Frozen header occurrences in iteration order.
 */
function readNodeResponseHeaders(headers: Headers): HeaderFields {
  const fields: HeaderField[] = [];

  headers.forEach((value, name) => {
    fields.push(
      Object.freeze({
        name: name.toLowerCase(),
        value,
      }),
    );
  });

  return Object.freeze(fields);
}

/**
 * Creates the error for a request that still has query fields.
 *
 * @returns Request error that does not include the query text.
 */
function createUnsupportedQueryError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Node Fetch transport does not accept query fields.",
    category: "invalid_request",
    phase: "transport",
    code: UNSUPPORTED_FETCH_QUERY_CODE,
    diagnostics: [],
  });
}

/**
 * Creates the error for a missing or unusable Fetch function.
 *
 * @returns Configuration error that does not include the supplied value.
 */
function createMissingFetchError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Node Fetch transport requires a fetch function.",
    category: "invalid_component_configuration",
    phase: "transport",
    code: MISSING_FETCH_CODE,
    diagnostics: [],
  });
}
