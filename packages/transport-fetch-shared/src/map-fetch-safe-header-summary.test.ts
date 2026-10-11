// Copyright © 2026 Mcont.

import type { HeaderFields } from "@evolutos/mconet-core-domain";
import { expect, it } from "vitest";

import { mapFetchSafeHeaderSummary } from "./map-fetch-safe-header-summary.js";

/** Secret that must not appear in a header snapshot. */
const secretHeaderValue = "snapshot-secret-value";

it("keeps reviewed headers in order and drops everything else", () => {
  const headers: HeaderFields = [
    { name: "content-type", value: "application/json" },
    { name: "authorization", value: `Bearer ${secretHeaderValue}` },
    { name: "x-request-id", value: "req-1" },
    { name: "set-cookie", value: `session=${secretHeaderValue}` },
    { name: "content-type", value: "text/plain" },
    { name: "x-api-key", value: secretHeaderValue },
    { name: "cookie", value: secretHeaderValue },
    { name: "proxy-authorization", value: secretHeaderValue },
    { name: "x-signature", value: secretHeaderValue },
  ];

  const summary = mapFetchSafeHeaderSummary(headers);

  expect(summary).toEqual([
    { name: "content-type", value: "application/json" },
    { name: "x-request-id", value: "req-1" },
    { name: "content-type", value: "text/plain" },
  ]);
  expect(JSON.stringify(summary)).not.toContain(secretHeaderValue);
  expect(Object.isFrozen(summary)).toBe(true);
});

it("lowercases an allowed header name without changing its value", () => {
  const headers: HeaderFields = [{ name: "Content-Type", value: " application/json " }];

  expect(mapFetchSafeHeaderSummary(headers)).toEqual([
    { name: "content-type", value: " application/json " },
  ]);
});

it("omits an allowed header whose value contains injected line breaks", () => {
  const headers: HeaderFields = [
    { name: "content-type", value: `application/json\r\nX-Secret: ${secretHeaderValue}` },
    { name: "content-length", value: "2" },
  ];

  const summary = mapFetchSafeHeaderSummary(headers);

  expect(summary).toEqual([{ name: "content-length", value: "2" }]);
  expect(JSON.stringify(summary)).not.toContain(secretHeaderValue);
});

it("returns an empty summary when no header is safe to record", () => {
  expect(mapFetchSafeHeaderSummary([])).toEqual([]);
  expect(mapFetchSafeHeaderSummary([{ name: "authorization", value: secretHeaderValue }])).toEqual(
    [],
  );
});
