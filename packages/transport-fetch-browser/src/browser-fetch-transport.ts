// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

import { resolveBrowserCredentials } from "./browser-credentials-policy.js";
import type {
  BrowserFetch,
  BrowserFetchCredentials,
  BrowserFetchTransportOptions,
} from "./browser-fetch-transport-options.js";

/** Stable code for a browser transport constructed without a Fetch function. */
const MISSING_FETCH_CODE = "missing_fetch";

/**
 * Global object that provides the platform Fetch function.
 *
 * Window and Worker expose `fetch` on their own global. The lookup reads that
 * property and does not consult `window`, `document`, or `self`.
 */
export interface BrowserFetchRealm {
  /** Platform Fetch function visible in this realm, when present. */
  readonly fetch?: BrowserFetch;
}

/**
 * Browser transport bound to one Fetch function.
 *
 * An explicit function is stored by reference. When it is omitted, construction
 * reads `fetch` from the current global object once. The credential mode is
 * selected during construction and defaults to `omit`. Neither path calls Fetch.
 */
export class BrowserFetchTransport {
  /** Fetch function bound to this instance. */
  readonly #fetch: BrowserFetch;

  /** Credential mode this instance passes to Fetch. */
  readonly #credentials: BrowserFetchCredentials;

  /**
   * Binds an explicit Fetch function, or the current realm's Fetch function.
   *
   * @param options Browser transport settings. Only `fetch` and `credentials` are read.
   */
  public constructor(options: BrowserFetchTransportOptions) {
    // An injected function stays intact. The realm is consulted only when the
    // caller did not supply one, and the function is not wrapped or called.
    this.#fetch = resolveBrowserFetch(options, globalThis);
    this.#credentials = resolveBrowserCredentials(options);
  }

  /**
   * Returns the credential mode this instance will pass to Fetch.
   *
   * The mode is the constructor selection. This method does not read cookies
   * or call Fetch.
   *
   * @returns Credential mode bound to this instance.
   */
  public credentials(): BrowserFetchCredentials {
    return this.#credentials;
  }

  /**
   * Reports whether this instance is bound to `fetchImplementation`.
   *
   * The check is reference equality. It does not call Fetch or inspect
   * credentials, redirects, or request data.
   *
   * @param fetchImplementation Candidate Fetch function.
   * @returns Whether this instance holds that exact function.
   */
  public boundTo(fetchImplementation: BrowserFetch): boolean {
    return this.#fetch === fetchImplementation;
  }
}

/**
 * Selects the Fetch function a browser transport binds.
 *
 * An explicit function wins. Otherwise the realm's own `fetch` is used, which
 * is the Window or Worker global when the constructor supplies `globalThis`.
 * A non-function option does not fall through to the realm.
 *
 * @param options Browser transport settings. Only `fetch` is read.
 * @param realm Realm whose `fetch` property supplies the default.
 * @returns The selected Fetch function.
 */
export function resolveBrowserFetch(
  options: BrowserFetchTransportOptions,
  realm: BrowserFetchRealm,
): BrowserFetch {
  if (typeof options.fetch === "function") {
    return options.fetch;
  }

  if (options.fetch !== undefined) {
    throw createMissingFetchError();
  }

  const realmFetch = realm.fetch;

  if (typeof realmFetch !== "function") {
    throw createMissingFetchError();
  }

  return realmFetch;
}

/**
 * Creates the error for a missing or unusable Fetch function.
 *
 * @returns Configuration error that does not include the supplied value.
 */
function createMissingFetchError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Browser Fetch transport requires a fetch function.",
    category: "invalid_component_configuration",
    phase: "transport",
    code: MISSING_FETCH_CODE,
    diagnostics: [],
  });
}
