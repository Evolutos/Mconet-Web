// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { mapFetchNetworkError } from "./map-fetch-network-error.js";

/** Host and message text that must not enter a normalized error. */
const secretHost = "secret-host.example";

it("classifies a browser-style TypeError without claiming DNS or CORS", () => {
  const error = mapFetchNetworkError(
    new TypeError(`Failed to fetch https://${secretHost}/v1`),
    "request",
  );

  expect(error).toMatchObject({
    category: "network",
    phase: "transport",
    code: "network_error",
    message: "Fetch could not complete the request.",
  });
  expect(error.cause).toBeUndefined();
  expect(String(error)).not.toContain(secretHost);
  expect(JSON.stringify(error)).not.toContain(secretHost);
});

it("classifies a platform DNS code without copying the hostname", () => {
  const error = mapFetchNetworkError(
    Object.assign(new TypeError(`getaddrinfo ENOTFOUND ${secretHost}`), {
      cause: { code: "ENOTFOUND" },
    }),
    "request",
  );

  expect(error).toMatchObject({
    category: "network",
    phase: "transport",
    code: "dns_error",
    message: "Fetch could not resolve the host.",
  });
  expect(String(error)).not.toContain(secretHost);
});

it("classifies a DNS code stored directly on the platform error", () => {
  const error = mapFetchNetworkError(
    Object.assign(new Error(`temporary failure ${secretHost}`), { code: "EAI_AGAIN" }),
    "request",
  );

  expect(error.code).toBe("dns_error");
  expect(String(error)).not.toContain(secretHost);
});

it("classifies a body read failure separately from a request TypeError", () => {
  const requestError = mapFetchNetworkError(new TypeError("Failed to fetch"), "request");
  const readError = mapFetchNetworkError(new TypeError(`read failed ${secretHost}`), "body");

  expect(readError).toMatchObject({
    category: "network",
    phase: "transport",
    code: "response_body_read_failed",
    message: "Fetch could not read the response body.",
  });
  expect(readError.code).not.toBe(requestError.code);
  expect(String(readError)).not.toContain(secretHost);
});

it("keeps a body-stage DNS code classified as a read failure", () => {
  const error = mapFetchNetworkError(
    Object.assign(new Error(secretHost), { code: "ENOTFOUND" }),
    "body",
  );

  expect(error.code).toBe("response_body_read_failed");
  expect(String(error)).not.toContain(secretHost);
});
