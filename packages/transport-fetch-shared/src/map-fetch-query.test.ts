// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { mapFetchBaseUrl } from "./map-fetch-base-url.js";
import { mapFetchQuery } from "./map-fetch-query.js";

/** Query text that must not enter a transport error. */
const secretValue = "query-order-secret";

const base = mapFetchBaseUrl({ kind: "absolute", value: "https://example.test/v1" });

it("preserves duplicate query names in declaration order", () => {
  const href = mapFetchQuery(base, [
    { name: "tag", value: "first" },
    { name: "q", value: "a&b" },
    { name: "tag", value: "second" },
  ]);

  expect(href).toBe("https://example.test/v1?tag=first&q=a%26b&tag=second");
  expect([...new URL(href).searchParams.entries()]).toEqual([
    ["tag", "first"],
    ["q", "a&b"],
    ["tag", "second"],
  ]);
  expect(new URL(href).pathname).toBe("/v1");
});

it("returns the base address when the query is empty", () => {
  expect(mapFetchQuery(base, [])).toBe("https://example.test/v1");
});

it("rejects an unsafe query value without including its text", () => {
  expect(() => mapFetchQuery(base, [{ name: "token", value: `bad\n${secretValue}` }])).toThrowError(
    expect.objectContaining({ code: "invalid_fetch_query" }),
  );

  try {
    mapFetchQuery(base, [{ name: "token", value: `bad\n${secretValue}` }]);
  } catch (error) {
    expect(String(error)).not.toContain(secretValue);
  }
});
