// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

import type {
  BrowserFetchCredentials,
  BrowserFetchTransportOptions,
} from "./browser-fetch-transport-options.js";

/** Credential mode used when the caller does not select one. */
const DEFAULT_CREDENTIALS: BrowserFetchCredentials = "omit";

/** Credential modes Fetch accepts. */
const CREDENTIAL_MODES: ReadonlySet<string> = new Set(["include", "omit", "same-origin"]);

/** Stable code for a credential mode outside the Fetch set. */
const INVALID_CREDENTIALS_CODE = "invalid_credentials";

/**
 * Selects the credential mode for one browser transport.
 *
 * Omission selects `omit`, so cookies are not sent unless the caller names a
 * mode. The selection does not read the Fetch function, a redirect mode, or
 * the platform global, and it does not call Fetch.
 *
 * @param options Browser transport settings. Only `credentials` is read.
 * @returns Credential mode to pass to Fetch.
 */
export function resolveBrowserCredentials(
  options: BrowserFetchTransportOptions,
): BrowserFetchCredentials {
  const credentials = options.credentials;

  if (credentials === undefined) {
    return DEFAULT_CREDENTIALS;
  }

  if (!CREDENTIAL_MODES.has(credentials)) {
    throw createInvalidCredentialsError();
  }

  return credentials;
}

/**
 * Creates the error for an unusable credential mode.
 *
 * @returns Configuration error that does not include the supplied value.
 */
function createInvalidCredentialsError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Browser Fetch credential mode is not supported.",
    category: "invalid_component_configuration",
    phase: "transport",
    code: INVALID_CREDENTIALS_CODE,
    diagnostics: [],
  });
}
