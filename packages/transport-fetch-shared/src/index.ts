// Copyright © 2026 Mcont.

/**
 * Shared Fetch request and response mapping for the browser and Node transports.
 *
 * The package validates protocol fields before either platform calls Fetch and
 * normalizes response metadata after a response arrives. Importing it does not
 * read platform globals, open a connection, or send a request.
 */
export { bridgeDeadlineSignal } from "./bridge-deadline-signal.js";
export type { DeadlineAbortBridge } from "./bridge-deadline-signal.js";
export { bridgeCallerAbortSignal } from "./bridge-caller-abort-signal.js";
export type { CallerAbortBridge } from "./bridge-caller-abort-signal.js";
export { readBoundedFetchResponseBody } from "./read-bounded-fetch-response-body.js";
export { readFetchResponseBody } from "./read-fetch-response-body.js";
export type { FetchResponseBodySource } from "./read-fetch-response-body.js";
export { mapFetchBody } from "./map-fetch-body.js";
export { mapFetchResponseMediaType } from "./map-fetch-response-media-type.js";
export { mapFetchStatus } from "./map-fetch-status.js";
export { mapFetchHeaders } from "./map-fetch-headers.js";
export type { FetchHeaderField } from "./map-fetch-headers.js";
export { mapFetchBaseUrl } from "./map-fetch-base-url.js";
export type { FetchBaseUrl } from "./map-fetch-base-url.js";
export { FETCH_HTTP_METHOD, mapFetchHttpMethod } from "./map-fetch-http-method.js";
export type { FetchHttpMethod } from "./map-fetch-http-method.js";
