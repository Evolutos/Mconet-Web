// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type { BrowserFetch } from "./browser-fetch-transport-options.js";
import type { BrowserFetchRealm } from "./browser-fetch-transport.js";
import { BrowserFetchTransport, resolveBrowserFetch } from "./browser-fetch-transport.js";

/** Value text that must not enter a configuration error. */
const secretValue = "fetch-secret-value";

it("binds each instance to its own explicit fetch function", () => {
  let calls = 0;
  const first = createFetch(() => {
    calls += 1;
  });
  const second = createFetch(() => {
    calls += 1;
  });

  const firstTransport = new BrowserFetchTransport({ fetch: first });
  const secondTransport = new BrowserFetchTransport({ fetch: second });

  expect(firstTransport.boundTo(first)).toBe(true);
  expect(firstTransport.boundTo(second)).toBe(false);
  expect(secondTransport.boundTo(second)).toBe(true);
  expect(secondTransport.boundTo(first)).toBe(false);
  expect(calls).toBe(0);
  expect(firstTransport.credentials()).toBe("omit");
  expect(new BrowserFetchTransport({ fetch: first, credentials: "include" }).credentials()).toBe(
    "include",
  );
  expect(globalFetchReads(() => new BrowserFetchTransport({ fetch: first }))).toBe(0);
});

it("binds an omitted fetch option to the current realm", () => {
  let calls = 0;
  const platformFetch = createFetch(() => {
    calls += 1;
  });
  const reads = withGlobalFetch(platformFetch, () => {
    expect(new BrowserFetchTransport({}).boundTo(platformFetch)).toBe(true);
  });

  expect(reads).toBe(1);
  expect(calls).toBe(0);
});

it("uses the fetch function exposed by a window realm or a worker realm", () => {
  const windowFetch = createFetch(() => undefined);
  const workerFetch = createFetch(() => undefined);
  const windowRealm = realmWithFetch(windowFetch);
  const workerRealm = realmWithFetch(workerFetch);

  expect(resolveBrowserFetch({}, windowRealm)).toBe(windowFetch);
  expect(resolveBrowserFetch({}, workerRealm)).toBe(workerFetch);
  expect(resolveBrowserFetch({ fetch: windowFetch }, workerRealm)).toBe(windowFetch);
});

it("rejects a realm without a fetch function", () => {
  let windowReads = 0;
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    get() {
      windowReads += 1;
      return { fetch: secretValue };
    },
  });

  try {
    expect(() => resolveBrowserFetch({}, {})).toThrow(
      expect.objectContaining({
        category: "invalid_component_configuration",
        phase: "transport",
        code: "missing_fetch",
        message: "Browser Fetch transport requires a fetch function.",
      }),
    );
  } finally {
    restoreProperty(globalThis, "window", windowDescriptor);
  }

  expect(windowReads).toBe(0);
});

it("rejects a non-function fetch value without copying it into the error", () => {
  const options = { fetch: secretValue } as unknown as { fetch: BrowserFetch };
  const reads = globalFetchReads(() => {
    expect(() => new BrowserFetchTransport(options)).toThrow(
      expect.objectContaining({ code: "missing_fetch" }),
    );
  });

  expect(reads).toBe(0);

  try {
    resolveBrowserFetch({}, { fetch: secretValue } as unknown as BrowserFetchRealm);
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toContain(secretValue);
    expect(JSON.stringify(error)).not.toContain(secretValue);
  }
});

/**
 * Counts reads of `globalThis.fetch` while `run` executes.
 *
 * @param run Action that must not use the platform Fetch global.
 * @returns Number of reads observed.
 */
function globalFetchReads(run: () => void): number {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  let reads = 0;

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    get() {
      reads += 1;
      return undefined;
    },
  });

  try {
    run();
  } finally {
    if (descriptor === undefined) {
      Reflect.deleteProperty(globalThis, "fetch");
    } else {
      Object.defineProperty(globalThis, "fetch", descriptor);
    }
  }

  return reads;
}

/**
 * Installs `fetchImplementation` as `globalThis.fetch` for `run`.
 *
 * @param fetchImplementation Fetch function the realm should expose.
 * @param run Action that resolves the platform Fetch function.
 * @returns Number of reads of `globalThis.fetch`.
 */
function withGlobalFetch(fetchImplementation: BrowserFetch, run: () => void): number {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  let reads = 0;

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    get() {
      reads += 1;
      return fetchImplementation;
    },
  });

  try {
    run();
  } finally {
    restoreProperty(globalThis, "fetch", descriptor);
  }

  return reads;
}

/**
 * Builds a realm whose only relevant property is `fetch`.
 *
 * @param fetchImplementation Fetch function exposed by the realm.
 * @returns Window-like or Worker-like global object.
 */
function realmWithFetch(fetchImplementation: BrowserFetch): BrowserFetchRealm {
  return { fetch: fetchImplementation };
}

/**
 * Restores a property descriptor replaced by a test.
 *
 * @param target Object whose property was replaced.
 * @param key Property name to restore.
 * @param descriptor Descriptor captured before replacement.
 */
function restoreProperty(
  target: object,
  key: "fetch" | "window",
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor === undefined) {
    Reflect.deleteProperty(target, key);
    return;
  }

  Object.defineProperty(target, key, descriptor);
}

/**
 * Creates a Fetch stand-in that records a call without performing I/O.
 *
 * @param record Call recorder.
 * @returns Fetch function with the platform signature.
 */
function createFetch(record: () => void): BrowserFetch {
  return () => {
    record();
    return Promise.reject(new Error("fetch called"));
  };
}
