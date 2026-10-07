// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Authorization } from "./authorization.js";
import type { Extensions } from "./extensions.js";
import type { HeaderFields } from "./header-fields.js";
import type { QueryFields } from "./query-fields.js";
import type { ResolvedServiceAccess } from "./resolved-service-access.js";
import type { UriValue } from "./uri-value.js";

it("defines a complete endpoint and authorization with resolved metadata", () => {
  // Exact equality keeps configuration precedence and behavior components out
  // while requiring every value needed by the request execution path.
  expectTypeOf<ResolvedServiceAccess>().toEqualTypeOf<{
    readonly endpoint: Extract<UriValue, { readonly kind: "absolute" }>;
    readonly authorization: Authorization;
    readonly headers: HeaderFields;
    readonly query: QueryFields;
    readonly apiVersion?: string;
    readonly projectId?: string;
    readonly tenantId?: string;
    readonly extensions: Extensions;
  }>();
});

it("retains one complete resolved access snapshot", () => {
  const access: ResolvedServiceAccess = {
    endpoint: { kind: "absolute", value: "https://models.example.test/v1" },
    authorization: { kind: "authorization.none" },
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

  // Observe all final access facts without merging layers, flattening repeated
  // fields, interpreting authorization, or exposing credential material.
  expect(access).toEqual({
    endpoint: { kind: "absolute", value: "https://models.example.test/v1" },
    authorization: { kind: "authorization.none" },
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

it("requires explicit endpoint authorization and resolved containers", () => {
  // Provider context may be legitimately absent after resolution, but endpoint,
  // authorization, and ordered metadata must have one final explicit value.
  expectTypeOf<{
    readonly endpoint: { readonly kind: "absolute"; readonly value: string };
    readonly authorization: Authorization;
    readonly headers: HeaderFields;
    readonly query: QueryFields;
    readonly extensions: Extensions;
  }>().toMatchTypeOf<ResolvedServiceAccess>();
  expectTypeOf<{
    readonly headers: HeaderFields;
    readonly query: QueryFields;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<ResolvedServiceAccess>();
});

it("rejects relative endpoints at the resolved type boundary", () => {
  // A relative endpoint still requires a base and therefore retains unresolved
  // semantics; only an absolute URI may enter the execution snapshot.
  expectTypeOf<{
    readonly endpoint: { readonly kind: "relative"; readonly value: string };
    readonly authorization: Authorization;
    readonly headers: HeaderFields;
    readonly query: QueryFields;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<ResolvedServiceAccess>();
});

it("prevents replacement of resolved access facts", () => {
  const proveReadonly = (access: ResolvedServiceAccess): void => {
    // Exercise prohibited writes only during type checking; this helper remains
    // uncalled and therefore cannot modify a live execution snapshot.
    // @ts-expect-error The resolved endpoint cannot be replaced.
    access.endpoint = { kind: "absolute", value: "https://changed.example.test" };
    // @ts-expect-error Ordered resolved headers cannot be extended.
    access.headers.push({ name: "x-added", value: "value" });
    // @ts-expect-error Authorization is an atomic resolved selection.
    access.authorization = { kind: "authorization.other" };
  };

  // Keep the compile-only helper reachable so removed readonly modifiers make
  // the expected-error directives fail strict TypeScript validation.
  expectTypeOf(proveReadonly).toBeFunction();
});
