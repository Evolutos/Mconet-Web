// Copyright © 2026 Mcont.

import type { HeaderFields } from "@evolutos/mconet-core-domain";
import { expect, it } from "vitest";

import { mapFetchResponseMediaType } from "./map-fetch-response-media-type.js";

it("parses one content-type header", () => {
  const headers: HeaderFields = [
    { name: "x-request-id", value: "req-1" },
    { name: "content-type", value: "application/json; charset=utf-8" },
  ];

  expect(mapFetchResponseMediaType(headers)).toEqual({
    type: "application",
    subtype: "json",
    parameters: { charset: "utf-8" },
  });
});

it("matches a content-type header name without rewriting its case first", () => {
  const headers: HeaderFields = [{ name: "Content-Type", value: "Text/Plain" }];

  expect(mapFetchResponseMediaType(headers)).toEqual({
    type: "text",
    subtype: "plain",
    parameters: {},
  });
});

it.each<HeaderFields>([[], [{ name: "x-request-id", value: "req-1" }]])(
  "leaves the media type absent when content-type is missing from %j",
  (headers) => {
    expect(mapFetchResponseMediaType(headers)).toBeUndefined();
  },
);

it("leaves the media type absent when content-type is repeated", () => {
  const headers: HeaderFields = [
    { name: "content-type", value: "application/json" },
    { name: "Content-Type", value: "text/plain" },
  ];

  expect(mapFetchResponseMediaType(headers)).toBeUndefined();
});

it("leaves the media type absent when the only content-type value is invalid", () => {
  const headers: HeaderFields = [{ name: "content-type", value: "application/json, text/plain" }];

  expect(mapFetchResponseMediaType(headers)).toBeUndefined();
});
