// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type {
  BrowserFetch,
  BrowserFetchCredentials,
  BrowserFetchRedirect,
  BrowserFetchTransportOptions,
} from "./browser-fetch-transport-options.js";

it("keeps the Fetch function, credentials, and redirect as separate fields", () => {
  expectTypeOf<BrowserFetchTransportOptions["fetch"]>().toEqualTypeOf<BrowserFetch | undefined>();
  expectTypeOf<BrowserFetchTransportOptions["credentials"]>().toEqualTypeOf<
    BrowserFetchCredentials | undefined
  >();
  expectTypeOf<BrowserFetchTransportOptions["redirect"]>().toEqualTypeOf<
    BrowserFetchRedirect | undefined
  >();
  expectTypeOf<keyof BrowserFetchTransportOptions>().toEqualTypeOf<
    "credentials" | "fetch" | "redirect"
  >();
  expectTypeOf<BrowserFetchCredentials>().not.toMatchTypeOf<BrowserFetchRedirect>();
  expectTypeOf<BrowserFetchRedirect>().not.toMatchTypeOf<BrowserFetchCredentials>();
  expectTypeOf<"follow">().not.toMatchTypeOf<BrowserFetchRedirect>();

  let calls = 0;
  const fetchImplementation: BrowserFetch = () => {
    calls += 1;
    return Promise.reject(new Error("fetch called"));
  };
  const fetchOnly: BrowserFetchTransportOptions = { fetch: fetchImplementation };
  const credentialsOnly: BrowserFetchTransportOptions = { credentials: "omit" };
  const redirectOnly: BrowserFetchTransportOptions = { redirect: "manual" };

  expect(fetchOnly.credentials).toBeUndefined();
  expect(fetchOnly.redirect).toBeUndefined();
  expect(credentialsOnly.fetch).toBeUndefined();
  expect(credentialsOnly.redirect).toBeUndefined();
  expect(redirectOnly.fetch).toBeUndefined();
  expect(redirectOnly.credentials).toBeUndefined();
  expect(calls).toBe(0);
});
