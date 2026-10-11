// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { BrowserFetchTransport } from "./browser-fetch-transport.js";
import { resolveBrowserReferrerPolicy } from "./browser-referrer-policy.js";
import type { BrowserFetch } from "./browser-fetch-transport-options.js";

it("uses no-referrer even when credentials and redirects are explicit", () => {
  const fetchImplementation: BrowserFetch = () => Promise.reject(new Error("fetch called"));

  expect(resolveBrowserReferrerPolicy()).toBe("no-referrer");
  expect(
    new BrowserFetchTransport({
      fetch: fetchImplementation,
      credentials: "include",
      redirect: "manual",
    }).referrerPolicy(),
  ).toBe("no-referrer");
  expect(resolveBrowserReferrerPolicy()).not.toBe("strict-origin-when-cross-origin");
});
