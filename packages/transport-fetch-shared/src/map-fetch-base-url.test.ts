// Copyright © 2026 Mcont.

import { ModelInteractionError, type UriValue } from "@evolutos/mconet-core-domain";
import { expect, it } from "vitest";

import { mapFetchBaseUrl } from "./map-fetch-base-url.js";

/**
 * Builds one absolute URI reference without adding query or user information.
 *
 * @param value Absolute URL text.
 * @returns URI value whose kind matches the absolute form.
 */
function absoluteUrl(value: string): UriValue {
  return { kind: "absolute", value };
}

it("maps an https scheme, host, and path", () => {
  expect(mapFetchBaseUrl(absoluteUrl("https://models.example.test/v1/models"))).toEqual({
    scheme: "https",
    host: "models.example.test",
    path: "/v1/models",
    href: "https://models.example.test/v1/models",
  });
});

it("maps an explicit http scheme without upgrading it", () => {
  expect(mapFetchBaseUrl(absoluteUrl("http://127.0.0.1:8080/v1"))).toEqual({
    scheme: "http",
    host: "127.0.0.1:8080",
    path: "/v1",
    href: "http://127.0.0.1:8080/v1",
  });
});

it("keeps a non-default port on the host", () => {
  expect(mapFetchBaseUrl(absoluteUrl("https://models.example.test:8443/v1")).host).toBe(
    "models.example.test:8443",
  );
});

it("omits the default https port from the host", () => {
  expect(mapFetchBaseUrl(absoluteUrl("https://models.example.test:443/v1"))).toEqual({
    scheme: "https",
    host: "models.example.test",
    path: "/v1",
    href: "https://models.example.test/v1",
  });
});

it("maps an IPv6 host with brackets", () => {
  expect(mapFetchBaseUrl(absoluteUrl("https://[2001:db8::1]:8443/v1"))).toEqual({
    scheme: "https",
    host: "[2001:db8::1]:8443",
    path: "/v1",
    href: "https://[2001:db8::1]:8443/v1",
  });
});

it("uses a root path when the URL has no path text", () => {
  expect(mapFetchBaseUrl(absoluteUrl("https://models.example.test"))).toEqual({
    scheme: "https",
    host: "models.example.test",
    path: "/",
    href: "https://models.example.test/",
  });
});

it("preserves a trailing path slash and a percent-encoded segment", () => {
  expect(mapFetchBaseUrl(absoluteUrl("https://models.example.test/v1/my%20model/"))).toEqual({
    scheme: "https",
    host: "models.example.test",
    path: "/v1/my%20model/",
    href: "https://models.example.test/v1/my%20model/",
  });
});

it("uses the parser path after removing dot segments", () => {
  expect(mapFetchBaseUrl(absoluteUrl("https://models.example.test/a/../b")).path).toBe("/b");
});

it("normalizes scheme and host case without changing the path", () => {
  expect(mapFetchBaseUrl(absoluteUrl("HTTP://Models.Example.TEST:8080/V1"))).toEqual({
    scheme: "http",
    host: "models.example.test:8080",
    path: "/V1",
    href: "http://models.example.test:8080/V1",
  });
});

it("returns a frozen base address", () => {
  expect(Object.isFrozen(mapFetchBaseUrl(absoluteUrl("https://models.example.test/v1")))).toBe(
    true,
  );
});

it.each([
  { kind: "relative", value: "/v1/models" },
  { kind: "relative", value: "v1/models" },
  absoluteUrl("javascript:alert(1)"),
  absoluteUrl("file:///tmp/a"),
  absoluteUrl("ws://models.example.test/v1"),
  absoluteUrl("https:///v1"),
  absoluteUrl("https://models.example.test/v1?q=1"),
  absoluteUrl("https://models.example.test/v1#fragment"),
  absoluteUrl(""),
])("rejects the base address %j", (url) => {
  expect(() => mapFetchBaseUrl(url)).toThrow(ModelInteractionError);
});

it("rejects user information and query text without copying either secret", () => {
  const secret = "base-url-secret-value";
  const urls = [
    absoluteUrl(`https://user:${secret}@models.example.test/v1`),
    absoluteUrl(`https://models.example.test/v1?token=${secret}`),
  ];

  for (const url of urls) {
    let caught: unknown;
    try {
      mapFetchBaseUrl(url);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ModelInteractionError);
    if (!(caught instanceof ModelInteractionError)) {
      return;
    }

    expect(caught).toMatchObject({
      name: "ModelInteractionError",
      category: "invalid_request",
      phase: "transport",
      code: "invalid_fetch_url",
      diagnostics: [],
      message: "Fetch URL is not an absolute HTTP or HTTPS base address.",
    });
    expect(caught.message).not.toContain(secret);
    expect(caught.stack ?? "").not.toContain(secret);
    expect(JSON.stringify(caught)).not.toContain(secret);
    expect(String(caught)).not.toContain(secret);
  }
});
