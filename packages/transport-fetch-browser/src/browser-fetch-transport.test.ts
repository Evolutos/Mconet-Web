// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type { BrowserFetch } from "./browser-fetch-transport-options.js";
import { BrowserFetchTransport, resolveExplicitBrowserFetch } from "./browser-fetch-transport.js";

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
  expect(resolveExplicitBrowserFetch({ fetch: first })).toBe(first);
  expect(calls).toBe(0);
});

it("rejects a missing fetch function without reading the platform global", () => {
  const reads = globalFetchReads(() => {
    expect(() => new BrowserFetchTransport({})).toThrow(
      expect.objectContaining({
        name: "ModelInteractionError",
        category: "invalid_component_configuration",
        phase: "transport",
        code: "missing_fetch",
        message: "Browser Fetch transport requires an explicit fetch function.",
      }),
    );
  });

  expect(reads).toBe(0);
});

it("rejects a non-function fetch value without copying it into the error", () => {
  const options = { fetch: secretValue } as unknown as { fetch: BrowserFetch };

  expect(() => new BrowserFetchTransport(options)).toThrow(
    expect.objectContaining({ code: "missing_fetch" }),
  );

  try {
    new BrowserFetchTransport(options);
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
