// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Authorization } from "./authorization.js";
import type { Extensions } from "./extensions.js";
import type { HeaderFields } from "./header-fields.js";
import type { QueryFields } from "./query-fields.js";
import type { ServiceAccess } from "./service-access.js";
import type { UriValue } from "./uri-value.js";

it("defines exactly the unresolved service access fields", () => {
  // Exact equality keeps model selection, protocol selection, resolved defaults,
  // transport behavior, and credential values outside this input contract.
  expectTypeOf<ServiceAccess>().toEqualTypeOf<{
    readonly endpoint?: UriValue;
    readonly authorization?: Authorization;
    readonly headers: HeaderFields;
    readonly query: QueryFields;
    readonly apiVersion?: string;
    readonly projectId?: string;
    readonly tenantId?: string;
    readonly extensions: Extensions;
  }>();
});

it("represents an explicit empty access contribution", () => {
  const access: ServiceAccess = {
    headers: [],
    query: [],
    extensions: {},
  };

  // Required empty collections distinguish a present access contribution from
  // an omitted ServiceAccess while optional values remain available for defaults.
  expect(access.headers).toHaveLength(0);
  expect(access.query).toHaveLength(0);
  expect(access.endpoint).toBeUndefined();
  expect(access.authorization).toBeUndefined();
});

it("retains endpoint, access context, and ordered multi-value fields", () => {
  const access: ServiceAccess = {
    endpoint: { kind: "absolute", value: "https://models.example.test/v1" },
    authorization: { kind: "example.signature" },
    headers: [
      { name: "x-feature", value: "alpha" },
      { name: "x-feature", value: "beta" },
    ],
    query: [
      { name: "tag", value: "first" },
      { name: "tag", value: "second" },
    ],
    apiVersion: "2026-10-01",
    projectId: "project-a",
    tenantId: "tenant-a",
    extensions: { routingHint: "primary" },
  };

  // Observe every access dimension without resolving defaults, combining
  // repeated fields, interpreting extensions, or exposing credential material.
  expect(access).toEqual({
    endpoint: { kind: "absolute", value: "https://models.example.test/v1" },
    authorization: { kind: "example.signature" },
    headers: [
      { name: "x-feature", value: "alpha" },
      { name: "x-feature", value: "beta" },
    ],
    query: [
      { name: "tag", value: "first" },
      { name: "tag", value: "second" },
    ],
    apiVersion: "2026-10-01",
    projectId: "project-a",
    tenantId: "tenant-a",
    extensions: { routingHint: "primary" },
  });
});

it("requires collection and extension fields without requiring unresolved values", () => {
  // The three required containers make merge inputs explicit, while endpoint,
  // authorization, and provider context remain legitimately absent before resolution.
  expectTypeOf<{
    readonly headers: HeaderFields;
    readonly query: QueryFields;
    readonly extensions: Extensions;
  }>().toMatchTypeOf<ServiceAccess>();
  expectTypeOf<{
    readonly headers: HeaderFields;
    readonly query: QueryFields;
  }>().not.toMatchTypeOf<ServiceAccess>();
});

it("prevents replacement of access fields and nested collection values", () => {
  const proveReadonly = (access: ServiceAccess): void => {
    // Exercise top-level and nested prohibited writes only during compilation;
    // this helper is never invoked and cannot mutate runtime access data.
    // @ts-expect-error The endpoint reference cannot be replaced.
    access.endpoint = { kind: "absolute", value: "https://changed.example.test" };
    // @ts-expect-error The header collection cannot grow.
    access.headers.push({ name: "x-added", value: "value" });
    for (const field of access.query) {
      // Use a safely narrowed occurrence to prove nested QueryField immutability,
      // then stop after the first item if this compile-only helper were invoked.
      // @ts-expect-error Query values remain immutable through ServiceAccess.
      field.value = "changed";
      break;
    }
  };

  // Keep the helper type-reachable so removed readonly modifiers turn the
  // expected compile errors into failing unused directives.
  expectTypeOf(proveReadonly).toBeFunction();
});
