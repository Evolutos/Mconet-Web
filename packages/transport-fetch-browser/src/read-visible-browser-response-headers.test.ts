// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import {
  readVisibleBrowserResponseHeaders,
  type VisibleResponseHeaderSource,
} from "./read-visible-browser-response-headers.js";

/** Name that is not present and must not be created. */
const hiddenName = "x-hidden-secret";

it("does not invent a content type or a hidden header", () => {
  const lookups: string[] = [];
  const source: VisibleResponseHeaderSource & { get(name: string): string | null } = {
    forEach(visit) {
      visit("text/plain", "Content-Type");
    },
    get(name) {
      lookups.push(name);
      return null;
    },
  };

  expect(readVisibleBrowserResponseHeaders(source)).toEqual([
    { name: "content-type", value: "text/plain" },
  ]);
  expect(lookups).toEqual([]);
  expect(readVisibleBrowserResponseHeaders(new Headers())).toEqual([]);
  expect(
    readVisibleBrowserResponseHeaders(source).some((header) => header.name === hiddenName),
  ).toBe(false);
  expect(
    readVisibleBrowserResponseHeaders(source).some((header) => header.value === "application/json"),
  ).toBe(false);
});

it("keeps an exposed empty value and does not add a missing one", () => {
  const source: VisibleResponseHeaderSource = {
    forEach(visit) {
      visit("", "x-request-id");
    },
  };

  expect(readVisibleBrowserResponseHeaders(source)).toEqual([{ name: "x-request-id", value: "" }]);
});
