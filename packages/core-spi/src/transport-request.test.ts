// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { HeaderFields, QueryFields, UriValue } from "@evolutos/mconet-core-domain";

import type { TransportBody } from "./transport-body.js";
import type { TransportRequest } from "./transport-request.js";

it("defines only immutable transport dispatch input facts", () => {
  // Exact equality excludes authorization state, credentials, response facts,
  // retry policy, execution context, decoders, and mutable transport instances.
  expectTypeOf<TransportRequest>().toEqualTypeOf<{
    readonly method: string;
    readonly url: UriValue;
    readonly headers: HeaderFields;
    readonly query: QueryFields;
    readonly body: TransportBody;
  }>();
});

it("preserves extension methods and repeated ordered request fields", () => {
  const url: UriValue = {
    kind: "absolute",
    value: "https://example.invalid/models/run",
  };
  const headers = [
    { name: "x-trace", value: "first" },
    { name: "x-trace", value: "second" },
  ] as const satisfies HeaderFields;
  const query = [
    { name: "tag", value: "one" },
    { name: "tag", value: "two" },
  ] as const satisfies QueryFields;
  const body: TransportBody = {
    kind: "bytes",
    bytes: new Uint8Array([123, 125]),
  };
  const request: TransportRequest = {
    method: "VENDOR-CALL",
    url,
    headers,
    query,
    body,
  };

  // Request composition neither normalizes an extension method nor joins,
  // merges, sorts, encodes, copies, or replaces any established value.
  expect(request.method).toBe("VENDOR-CALL");
  expect(request.url).toBe(url);
  expect(request.headers).toBe(headers);
  expect(request.headers.map(({ value }) => value)).toEqual(["first", "second"]);
  expect(request.query).toBe(query);
  expect(request.query.map(({ value }) => value)).toEqual(["one", "two"]);
  expect(request.body).toBe(body);
});

it("can represent a pre-authorization request without authorization markers", () => {
  const request: TransportRequest = {
    method: "POST",
    url: { kind: "relative", value: "/models/run" },
    headers: [],
    query: [],
    body: { kind: "bytes", bytes: new Uint8Array() },
  };

  // Empty headers and query are explicit ordered collections. Authorization may
  // return a new request with additional fields; no mutable flag or credential is
  // embedded into this snapshot to claim that authorization already occurred.
  expect(request.headers).toEqual([]);
  expect(request.query).toEqual([]);
  expect(Object.hasOwn(request, "authorization")).toBe(false);
  expect(Object.hasOwn(request, "authorized")).toBe(false);
});

it("prevents request facts from being replaced", () => {
  const proveReadonly = (
    request: TransportRequest,
    url: UriValue,
    headers: HeaderFields,
    query: QueryFields,
    body: TransportBody,
  ): void => {
    // This compile-only helper locks every composed request fact without
    // mutating a runtime request or caller-owned byte view.
    // @ts-expect-error Method text cannot be replaced.
    request.method = "DELETE";
    // @ts-expect-error Final URI reference cannot be replaced.
    request.url = url;
    // @ts-expect-error Header collection cannot be replaced.
    request.headers = headers;
    // @ts-expect-error Query collection cannot be replaced.
    request.query = query;
    // @ts-expect-error Encoded body cannot be replaced.
    request.body = body;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
