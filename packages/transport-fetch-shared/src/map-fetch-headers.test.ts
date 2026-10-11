// Copyright © 2026 Mcont.

import {
  ModelInteractionError,
  type HeaderField,
  type HeaderFields,
} from "@evolutos/mconet-core-domain";
import { expect, it } from "vitest";

import { mapFetchHeaders } from "./map-fetch-headers.js";

/** Header value that must never appear in a rejection. */
const secretHeaderValue = "header-secret-value";

it("preserves header order and repeated names", () => {
  const headers: HeaderFields = [
    { name: "accept", value: "application/json" },
    { name: "x-region", value: "us" },
    { name: "accept", value: "text/plain" },
  ];

  expect(mapFetchHeaders(headers)).toEqual([
    { name: "accept", value: "application/json" },
    { name: "x-region", value: "us" },
    { name: "accept", value: "text/plain" },
  ]);
});

it("keeps an empty header list and an empty field value", () => {
  expect(mapFetchHeaders([])).toEqual([]);
  expect(mapFetchHeaders([{ name: "x-empty", value: "" }])).toEqual([
    { name: "x-empty", value: "" },
  ]);
});

it("does not trim or join a header value", () => {
  expect(mapFetchHeaders([{ name: "accept", value: " application/json " }])).toEqual([
    { name: "accept", value: " application/json " },
  ]);
});

it("copies header fields so later input changes stay local", () => {
  const header = { name: "accept", value: "text/plain" };
  const mapped = mapFetchHeaders([header]);

  header.value = "changed";

  expect(mapped[0]).toEqual({ name: "accept", value: "text/plain" });
  expect(Object.isFrozen(mapped)).toBe(true);
  expect(Object.isFrozen(mapped[0])).toBe(true);
});

it.each([
  [{ name: "Accept", value: "application/json" }],
  [{ name: "accept name", value: "application/json" }],
  [{ name: "accept\r\n", value: "application/json" }],
  [{ name: "", value: "application/json" }],
  [{ name: "accept", value: "application/json\r\nX-Injected: 1" }],
  [{ name: "accept", value: "bad\nvalue" }],
  [{ name: "accept", value: "bad\0value" }],
])("rejects the unsafe header %j", (headers) => {
  expect(() => mapFetchHeaders(headers)).toThrow(ModelInteractionError);
});

it("rejects a sparse header list", () => {
  const headers: HeaderField[] = [];
  headers.length = 1;

  expect(() => mapFetchHeaders(headers)).toThrow(ModelInteractionError);
});

it("rejects an unsafe header without copying its name or value", () => {
  let caught: unknown;

  try {
    mapFetchHeaders([
      {
        name: "x-credential",
        value: `Bearer ${secretHeaderValue}\r\nAuthorization: injected`,
      },
    ]);
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
    code: "invalid_fetch_header",
    diagnostics: [],
    message: "Fetch header cannot be sent.",
  });
  expect(caught.message).not.toContain(secretHeaderValue);
  expect(caught.stack ?? "").not.toContain(secretHeaderValue);
  expect(JSON.stringify(caught)).not.toContain(secretHeaderValue);
  expect(String(caught)).not.toContain(secretHeaderValue);
});
