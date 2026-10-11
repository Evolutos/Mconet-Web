// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { assertBrowserRequestHeaders } from "./browser-forbidden-headers.js";

/** Header value that must not enter the rejection. */
const secretValue = "header-secret-value";

/** Representative names Fetch keeps under user-agent control. */
const forbiddenNames = [
  "accept-charset",
  "accept-encoding",
  "access-control-request-headers",
  "access-control-request-method",
  "connection",
  "content-length",
  "cookie",
  "cookie2",
  "date",
  "dnt",
  "expect",
  "Host",
  "keep-alive",
  "origin",
  "referer",
  "set-cookie",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "via",
  "proxy-authorization",
  "Proxy-Connection",
  "sec-fetch-site",
] as const;

it("allows caller-controlled request headers", () => {
  expect(() =>
    assertBrowserRequestHeaders([
      { name: "authorization", value: secretValue },
      { name: "content-type", value: "application/json" },
      { name: "x-http-method", value: "GET" },
    ]),
  ).not.toThrow();
});

it("rejects forbidden request headers without copying the value", () => {
  for (const name of forbiddenNames) {
    expect(() => assertBrowserRequestHeaders([{ name, value: secretValue }])).toThrow(
      expect.objectContaining({
        name: "ModelInteractionError",
        category: "invalid_request",
        phase: "transport",
        code: "forbidden_request_header",
        message: "Browser Fetch rejected a forbidden request header.",
      }),
    );
  }

  try {
    assertBrowserRequestHeaders([{ name: "cookie", value: secretValue }]);
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toContain(secretValue);
    expect(String(error)).not.toContain("cookie");
    expect(JSON.stringify(error)).not.toContain(secretValue);
  }
});

it("rejects a method-override header that names a forbidden method", () => {
  expect(() =>
    assertBrowserRequestHeaders([
      { name: "x-method-override", value: `GET, TRACE, ${secretValue}` },
    ]),
  ).toThrow(expect.objectContaining({ code: "forbidden_request_header" }));

  try {
    assertBrowserRequestHeaders([
      { name: "x-http-method-override", value: secretValue },
      { name: "x-http-method", value: "TRACK" },
    ]);
  } catch (error) {
    expect(String(error)).not.toContain(secretValue);
    expect(String(error)).not.toContain("TRACK");
  }
});
