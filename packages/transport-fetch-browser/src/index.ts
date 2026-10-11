// Copyright © 2026 Mcont.

/**
 * Public module boundary for the browser Fetch transport.
 *
 * The options contract names the Fetch function, credential mode, and redirect
 * mode separately. The transport constructor binds an explicit Fetch function
 * and does not read platform globals, call Fetch, or apply a credential or
 * redirect policy.
 */
export { BrowserFetchTransport } from "./browser-fetch-transport.js";
export type {
  BrowserFetch,
  BrowserFetchCredentials,
  BrowserFetchRedirect,
  BrowserFetchTransportOptions,
} from "./browser-fetch-transport-options.js";
