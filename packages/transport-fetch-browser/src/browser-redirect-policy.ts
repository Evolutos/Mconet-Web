// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

import type {
  BrowserFetchRedirect,
  BrowserFetchTransportOptions,
} from "./browser-fetch-transport-options.js";

/** Redirect mode used when the caller does not select one. */
const DEFAULT_REDIRECT: BrowserFetchRedirect = "error";

/**
 * Redirect modes that do not ask Fetch to send the request again.
 *
 * `follow` is absent. Following would let the browser resend authorization to
 * the next origin.
 */
const REDIRECT_MODES: ReadonlySet<string> = new Set(["error", "manual"]);

/** Stable code for a redirect mode that can replay a request. */
const INVALID_REDIRECT_CODE = "invalid_redirect";

/**
 * Selects the redirect mode for one browser transport.
 *
 * Omission selects `error`. `manual` returns the redirect without another
 * request. Both modes keep authorization on the original origin. The selection
 * does not read the Fetch function, credentials, or the platform global, and
 * it does not call Fetch.
 *
 * @param options Browser transport settings. Only `redirect` is read.
 * @returns Redirect mode to pass to Fetch.
 */
export function resolveBrowserRedirect(
  options: BrowserFetchTransportOptions,
): BrowserFetchRedirect {
  const redirect = options.redirect;

  if (redirect === undefined) {
    return DEFAULT_REDIRECT;
  }

  if (!REDIRECT_MODES.has(redirect)) {
    throw createInvalidRedirectError();
  }

  return redirect;
}

/**
 * Reports whether Fetch will send the original authorization to another origin.
 *
 * @param mode Resolved redirect mode.
 * @returns Always `false` for the modes this transport accepts.
 */
export function browserRedirectForwardsAuthorization(mode: BrowserFetchRedirect): boolean {
  switch (mode) {
    case "error":
    case "manual":
      return false;
    default: {
      const unsupported: never = mode;
      return unsupported;
    }
  }
}

/**
 * Creates the error for a redirect mode this transport does not accept.
 *
 * @returns Configuration error that does not include the supplied value.
 */
function createInvalidRedirectError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Browser Fetch redirect mode is not supported.",
    category: "invalid_component_configuration",
    phase: "transport",
    code: INVALID_REDIRECT_CODE,
    diagnostics: [],
  });
}
