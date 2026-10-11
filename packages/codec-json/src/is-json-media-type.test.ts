// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { isJsonMediaType } from "./is-json-media-type.js";

it.each([
  "application/json",
  "APPLICATION/JSON",
  "application/json;charset=utf-8",
  "application/json; charset=UTF-8",
  "text/json",
  "application/problem+json",
  "application/vnd.api+json;charset=utf-8",
  "Application/Problem+JSON",
])("accepts the JSON media type %j", (value) => {
  expect(isJsonMediaType(value)).toBe(true);
});

it.each([
  undefined,
  null,
  1,
  "",
  "application/json;",
  "text/plain",
  "application/json-patch",
  "application/+json",
  "application/json+xml",
  "application/json, text/plain",
])("rejects the non-JSON media type %j", (value) => {
  expect(isJsonMediaType(value)).toBe(false);
});
