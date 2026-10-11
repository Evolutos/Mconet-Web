// Copyright © 2026 Mcont.

/**
 * Public module boundary for the browser Fetch transport.
 *
 * The options contract names the Fetch function, credential mode, and redirect
 * mode separately. The constructor binds an explicit Fetch function, or the
 * current realm's Fetch function when that option is omitted. Importing this
 * module does not read platform globals, call Fetch, or apply a credential or
 * redirect policy.
 */
export { BrowserFetchTransport } from "./browser-fetch-transport.js";
export type {
  BrowserFetch,
  BrowserFetchCredentials,
  BrowserFetchRedirect,
  BrowserFetchTransportOptions,
} from "./browser-fetch-transport-options.js";
