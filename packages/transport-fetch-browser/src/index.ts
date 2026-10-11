// Copyright © 2026 Mcont.

/**
 * Public module boundary for the browser Fetch transport.
 *
 * The options contract names the Fetch function, credential mode, and redirect
 * mode separately. The constructor binds an explicit Fetch function, or the
 * current realm's Fetch function when that option is omitted, and selects a
 * credential mode that defaults to `omit`, and a redirect mode that defaults
 * to `error`, and the referrer policy is `no-referrer`. Forbidden request
 * headers are rejected before Fetch. Importing this module does not read
 * platform globals or call Fetch.
 */
export { assertBrowserRequestHeaders } from "./browser-forbidden-headers.js";
export { resolveBrowserCredentials } from "./browser-credentials-policy.js";
export {
  browserRedirectForwardsAuthorization,
  resolveBrowserRedirect,
} from "./browser-redirect-policy.js";
export {
  BROWSER_REFERRER_POLICY,
  resolveBrowserReferrerPolicy,
} from "./browser-referrer-policy.js";
export type { BrowserReferrerPolicy } from "./browser-referrer-policy.js";
export { BrowserFetchTransport } from "./browser-fetch-transport.js";
export type {
  BrowserFetch,
  BrowserFetchCredentials,
  BrowserFetchRedirect,
  BrowserFetchTransportOptions,
} from "./browser-fetch-transport-options.js";
