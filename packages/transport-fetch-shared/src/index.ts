// Copyright © 2026 Mcont.

/**
 * Shared Fetch request mapping for the browser and Node transports.
 *
 * The package validates protocol request fields before either platform calls
 * Fetch. Importing it does not read platform globals, open a connection, or
 * send a request.
 */
export { mapFetchHeaders } from "./map-fetch-headers.js";
export type { FetchHeaderField } from "./map-fetch-headers.js";
export { mapFetchBaseUrl } from "./map-fetch-base-url.js";
export type { FetchBaseUrl } from "./map-fetch-base-url.js";
export { FETCH_HTTP_METHOD, mapFetchHttpMethod } from "./map-fetch-http-method.js";
export type { FetchHttpMethod } from "./map-fetch-http-method.js";
