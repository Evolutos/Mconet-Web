// Copyright © 2026 Mcont.

/**
 * Fetch implementation the browser transport may call.
 *
 * The signature matches the platform `fetch` so an injected function stays
 * usable from a Window or a Worker. Naming the function does not read
 * `globalThis` or send a request.
 */
export type BrowserFetch = typeof globalThis.fetch;

/**
 * Credential mode the browser transport may pass to Fetch.
 *
 * The union matches the platform modes. It is not a redirect policy, and an
 * omitted field is not itself a mode.
 */
export type BrowserFetchCredentials = "include" | "omit" | "same-origin";

/**
 * Redirect mode the browser transport may pass to Fetch.
 *
 * `error` rejects a redirect. `manual` returns it without resending the
 * request. `follow` is absent because automatic following can resend
 * authorization to another origin.
 */
export type BrowserFetchRedirect = "error" | "manual";

/**
 * Caller-supplied browser Fetch settings.
 *
 * The Fetch function, credential mode, and redirect mode are separate fields.
 * Replacing `fetch` cannot select a credential or redirect mode, and setting
 * one mode cannot imply the other. This contract does not read platform
 * globals, call Fetch, or choose the value of an omitted field.
 */
export interface BrowserFetchTransportOptions {
  /** Optional Fetch function. Omission does not select credentials or redirects. */
  readonly fetch?: BrowserFetch;

  /** Optional credential mode. Omission does not select a Fetch function or redirect. */
  readonly credentials?: BrowserFetchCredentials;

  /** Optional redirect mode. Omission does not select a Fetch function or credentials. */
  readonly redirect?: BrowserFetchRedirect;
}
