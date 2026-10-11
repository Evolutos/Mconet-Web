// Copyright © 2026 Mcont.

/** Referrer policy that sends no URL to the next request. */
export const BROWSER_REFERRER_POLICY = "no-referrer";

/** Referrer policy value the browser transport can pass to Fetch. */
export type BrowserReferrerPolicy = typeof BROWSER_REFERRER_POLICY;

/**
 * Referrer policy the browser transport passes to Fetch.
 *
 * The value is fixed. Credential and redirect choices cannot widen it to the
 * platform default, which can still send an origin. This function does not
 * read options, the platform global, or call Fetch.
 *
 * @returns The only referrer policy this transport uses.
 */
export function resolveBrowserReferrerPolicy(): BrowserReferrerPolicy {
  return BROWSER_REFERRER_POLICY;
}
