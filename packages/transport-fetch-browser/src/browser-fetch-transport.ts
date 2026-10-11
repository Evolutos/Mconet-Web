// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

import type {
  BrowserFetch,
  BrowserFetchTransportOptions,
} from "./browser-fetch-transport-options.js";

/** Stable code for a browser transport constructed without a Fetch function. */
const MISSING_FETCH_CODE = "missing_fetch";

/**
 * Browser transport bound to one explicit Fetch function.
 *
 * Construction stores that function by reference and does not call it. The
 * platform global is not read, so one instance cannot silently replace the
 * function bound to another instance.
 */
export class BrowserFetchTransport {
  /** Fetch function supplied to this instance. */
  readonly #fetch: BrowserFetch;

  /**
   * Binds the explicit Fetch function from `options`.
   *
   * @param options Browser transport settings. Only `fetch` is read.
   */
  public constructor(options: BrowserFetchTransportOptions) {
    // Keep the caller's function intact. A wrapper would hide which
    // implementation this instance runs, and the platform global is not a
    // substitute for the injected function.
    this.#fetch = resolveExplicitBrowserFetch(options);
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
 * Returns the explicit Fetch function a browser transport must bind.
 *
 * @param options Browser transport settings. Only `fetch` is read.
 * @returns The caller-supplied Fetch function.
 */
export function resolveExplicitBrowserFetch(options: BrowserFetchTransportOptions): BrowserFetch {
  const fetchImplementation = options.fetch;

  if (typeof fetchImplementation !== "function") {
    throw createMissingFetchError();
  }

  return fetchImplementation;
}

/**
 * Creates the error for a missing or unusable Fetch function.
 *
 * @returns Configuration error that does not include the supplied value.
 */
function createMissingFetchError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "Browser Fetch transport requires an explicit fetch function.",
    category: "invalid_component_configuration",
    phase: "transport",
    code: MISSING_FETCH_CODE,
    diagnostics: [],
  });
}
