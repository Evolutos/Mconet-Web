// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { HeaderFields, UriValue } from "@evolutos/mconet-core-domain";
import type { TransportRequest } from "@evolutos/mconet-core-spi";

import { createSafePreAuthorizationRequestSnapshot } from "./create-safe-pre-authorization-request-snapshot.js";
import type { SafePreAuthorizationRequestSnapshot } from "./safe-pre-authorization-request-snapshot.js";

/** Secret that must not appear in the pre-authorization snapshot. */
const secretText = "pre-authorization-secret";

it("defines a snapshot without body, query values, or an authorization object", () => {
  expectTypeOf<SafePreAuthorizationRequestSnapshot>().toEqualTypeOf<
    Readonly<{
      method: string;
      url: UriValue;
      headers: HeaderFields;
      queryCount: number;
      bodyByteLength: number;
    }>
  >();

  type ForbiddenField = Extract<
    keyof SafePreAuthorizationRequestSnapshot,
    "authorization" | "body" | "bytes" | "credential" | "query"
  >;
  const forbidden: ForbiddenField[] = [];
  expect(forbidden).toEqual([]);
});

it("omits authorization headers and keeps allowlisted headers in order", () => {
  const request = createRequest({
    headers: [
      { name: "Content-Type", value: "application/json" },
      { name: "authorization", value: `Bearer ${secretText}` },
      { name: "accept", value: "application/json" },
      { name: "proxy-authorization", value: secretText },
      { name: "cookie", value: secretText },
      { name: "set-cookie", value: secretText },
      { name: "x-api-key", value: secretText },
      { name: "content-type", value: "text/plain" },
    ],
  });

  const snapshot = createSafePreAuthorizationRequestSnapshot(request);

  expect(snapshot.headers).toEqual([
    { name: "content-type", value: "application/json" },
    { name: "accept", value: "application/json" },
    { name: "content-type", value: "text/plain" },
  ]);
  expect(snapshot.headers).not.toBe(request.headers);
  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(Object.isFrozen(snapshot.headers)).toBe(true);
  expect(JSON.stringify(snapshot)).not.toContain(secretText);
  expect(request.headers).toHaveLength(8);
});

it("does not read the value of a dropped authorization header", () => {
  const authorizationHeader: { name: string; value: string } = { name: "authorization", value: "" };
  Object.defineProperty(authorizationHeader, "value", {
    configurable: true,
    enumerable: true,
    get() {
      throw new Error(secretText);
    },
  });
  const request = createRequest({
    headers: [authorizationHeader, { name: "accept", value: "application/json" }],
  });

  const snapshot = createSafePreAuthorizationRequestSnapshot(request);

  expect(snapshot.headers).toEqual([{ name: "accept", value: "application/json" }]);
  expect(JSON.stringify(snapshot)).not.toContain(secretText);
});

it("removes query and fragment text and does not copy query values or body bytes", () => {
  const request = createRequest({
    url: {
      kind: "absolute",
      value: `https://example.test/v1/messages?api_key=${secretText}#${secretText}`,
    },
    query: [{ name: "api_key", value: secretText }],
    bodyText: secretText,
  });

  const snapshot = createSafePreAuthorizationRequestSnapshot(request);

  expect(snapshot.url).toEqual({
    kind: "absolute",
    value: "https://example.test/v1/messages",
  });
  expect(snapshot.queryCount).toBe(1);
  expect(snapshot.bodyByteLength).toBe(new TextEncoder().encode(secretText).byteLength);
  expect(JSON.stringify(snapshot)).not.toContain(secretText);
  expect(request.url.value).toContain(secretText);
});

it("omits an allowlisted header whose value contains a line break", () => {
  const request = createRequest({
    headers: [
      { name: "content-type", value: `application/json\r\nX-Secret: ${secretText}` },
      { name: "content-length", value: "2" },
    ],
  });

  const snapshot = createSafePreAuthorizationRequestSnapshot(request);

  expect(snapshot.headers).toEqual([{ name: "content-length", value: "2" }]);
  expect(JSON.stringify(snapshot)).not.toContain(secretText);
});

function createRequest(input: {
  readonly headers?: HeaderFields;
  readonly url?: UriValue;
  readonly query?: TransportRequest["query"];
  readonly bodyText?: string;
}): TransportRequest {
  return {
    method: "POST",
    url: input.url ?? { kind: "relative", value: "messages" },
    headers: input.headers ?? [],
    query: input.query ?? [],
    body: {
      kind: "bytes",
      bytes: new TextEncoder().encode(input.bodyText ?? ""),
    },
  };
}
