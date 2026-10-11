// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import { expect, it } from "vitest";

import { FETCH_HTTP_METHOD, mapFetchHttpMethod } from "./map-fetch-http-method.js";

/** Method text that must never be copied into an error or its string form. */
const rejectedMethodText = "GET\r\nX-Credential: method-secret-value";

it("accepts exactly the reviewed Fetch method whitelist", () => {
  expect(Object.values(FETCH_HTTP_METHOD).sort()).toEqual([
    "DELETE",
    "GET",
    "HEAD",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
  ]);
});

it.each(Object.values(FETCH_HTTP_METHOD))("maps the supported method %s unchanged", (method) => {
  expect(mapFetchHttpMethod(method)).toBe(method);
  expect(mapFetchHttpMethod(mapFetchHttpMethod(method))).toBe(method);
});

it.each(Object.values(FETCH_HTTP_METHOD))("rejects a lowercase spelling of %s", (method) => {
  expect(() => mapFetchHttpMethod(method.toLowerCase())).toThrow(ModelInteractionError);
});

it.each([
  "CONNECT",
  "TRACE",
  "TRACK",
  "connect",
  "Post",
  "Patch",
  "FOO",
  "QUERY",
  "",
  " POST",
  "POST ",
  "GET\n",
])(
  "rejects the unsupported method %j",
  (method) => {
    expect(() => mapFetchHttpMethod(method)).toThrow(ModelInteractionError);
  },
);

it("reports an unsupported method without copying its text", () => {
  let caught: unknown;

  try {
    mapFetchHttpMethod(rejectedMethodText);
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
    code: "unsupported_http_method",
    diagnostics: [],
    message: "HTTP method is not supported by the Fetch transport.",
  });

  // The rejected token can carry injected header text, so no public field or
  // printable form may retain it.
  expect(caught.message).not.toContain(rejectedMethodText);
  expect(caught.stack ?? "").not.toContain("method-secret-value");
  expect(JSON.stringify(caught)).not.toContain("method-secret-value");
  expect(String(caught)).not.toContain("method-secret-value");
});
