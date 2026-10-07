// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type {
  Authorization,
  HeaderFields,
  QueryFields,
  UriValue,
} from "@evolutos/mconet-core-domain";

import type { TransportRequestPlan } from "./transport-request-plan.js";

it("defines only immutable pre-encoding transport planning facts", () => {
  // Exact equality excludes encoded body state, signing modes, request sending,
  // URL assembly, credential access, and component-selection behavior.
  expectTypeOf<TransportRequestPlan>().toEqualTypeOf<{
    readonly endpoint: Extract<UriValue, { readonly kind: "absolute" }>;
    readonly path: string;
    readonly method: string;
    readonly headers: HeaderFields;
    readonly query: QueryFields;
    readonly authorization: Authorization;
    readonly transportExtensions: Readonly<Record<string, unknown>>;
  }>();
});

it("preserves endpoint routing authorization and extension identities", () => {
  const endpoint = {
    kind: "absolute",
    value: "https://models.example.test/v1",
  } as const;
  const authorization: Authorization = { kind: "authorization.bearer" };
  const transportExtensions = { redirect: "manual", credentials: "omit" } as const;
  const plan: TransportRequestPlan = {
    endpoint,
    path: "/chat/completions",
    method: "POST",
    headers: [],
    query: [],
    authorization,
    transportExtensions,
  };

  // The carrier neither joins URL parts nor clones handler or transport inputs;
  // later Runtime stages consume the exact validated planning values.
  expect(plan.endpoint).toBe(endpoint);
  expect(plan.endpoint.value).toBe("https://models.example.test/v1");
  expect(plan.path).toBe("/chat/completions");
  expect(plan.method).toBe("POST");
  expect(plan.authorization).toBe(authorization);
  expect(plan.transportExtensions).toBe(transportExtensions);
});

it("retains repeated header and query occurrences in declaration order", () => {
  const headers = [
    { name: "x-feature", value: "alpha" },
    { name: "x-feature", value: "beta" },
  ] as const;
  const query = [
    { name: "tag", value: "first" },
    { name: "tag", value: "second" },
  ] as const;
  const plan: TransportRequestPlan = {
    endpoint: { kind: "absolute", value: "https://models.example.test" },
    path: "/v1/models",
    method: "GET",
    headers,
    query,
    authorization: { kind: "authorization.none" },
    transportExtensions: {},
  };

  // Separate occurrences retain protocol precedence and multi-value semantics;
  // this value never collapses them into Record<string, string>.
  expect(plan.headers).toBe(headers);
  expect(plan.headers.map(({ value }) => value)).toEqual(["alpha", "beta"]);
  expect(plan.query).toBe(query);
  expect(plan.query.map(({ value }) => value)).toEqual(["first", "second"]);
});

it("requires an absolute endpoint at the type boundary", () => {
  const relative: UriValue = { kind: "relative", value: "/v1" };

  // Access resolution owns absolute endpoint production. A protocol path stays
  // in its dedicated field instead of masquerading as the resolved endpoint.
  expectTypeOf(relative).not.toMatchTypeOf<TransportRequestPlan["endpoint"]>();
  expectTypeOf<TransportRequestPlan["endpoint"]>().toEqualTypeOf<{
    readonly kind: "absolute";
    readonly value: string;
  }>();
});

it("prevents replacement or collection membership mutation", () => {
  const proveReadonly = (plan: TransportRequestPlan, authorization: Authorization): void => {
    // This compile-only helper locks routing facts, ordered occurrences, handler
    // input, and extension membership without mutating a runtime fixture.
    // @ts-expect-error The resolved endpoint cannot be replaced.
    plan.endpoint = { kind: "absolute", value: "https://replacement.test" };
    // @ts-expect-error The protocol path cannot be replaced.
    plan.path = "/replacement";
    // @ts-expect-error Ordered headers cannot gain another occurrence.
    plan.headers.push({ name: "x-extra", value: "value" });
    // @ts-expect-error Ordered query values cannot gain another occurrence.
    plan.query.push({ name: "extra", value: "value" });
    // @ts-expect-error Authorization cannot be replaced.
    plan.authorization = authorization;
    // @ts-expect-error Transport extension membership cannot be rewritten.
    plan.transportExtensions.example = true;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});

it("does not expose encoded body signing assembly or execution behavior", () => {
  // Web request planning deliberately stops before payload encoding and excludes
  // unsupported body/chunk signing concepts from the public project surface.
  expectTypeOf<TransportRequestPlan>().not.toHaveProperty("body");
  expectTypeOf<TransportRequestPlan>().not.toHaveProperty("bodySigningRequirement");
  expectTypeOf<TransportRequestPlan>().not.toHaveProperty("signingMode");
  expectTypeOf<TransportRequestPlan>().not.toHaveProperty("url");
  expectTypeOf<TransportRequestPlan>().not.toHaveProperty("encode");
  expectTypeOf<TransportRequestPlan>().not.toHaveProperty("apply");
  expectTypeOf<TransportRequestPlan>().not.toHaveProperty("send");
});
