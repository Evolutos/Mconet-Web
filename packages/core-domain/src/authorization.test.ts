// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Authorization } from "./authorization.js";
import type { OpenIdentifier } from "./open-identifier.js";

it("defines only the immutable authorization kind contract", () => {
  // Exact equality prevents credentials, headers, endpoints, extensions, or
  // handler behavior from entering the public base abstraction implicitly.
  expectTypeOf<Authorization>().toEqualTypeOf<{
    readonly kind: OpenIdentifier;
  }>();
});

it("accepts standard-looking and application-defined authorization kinds", () => {
  const authorizations: readonly Authorization[] = [
    { kind: "http.bearer" },
    { kind: "application.session.exchange" },
  ];

  // OpenIdentifier keeps the vocabulary extensible instead of restricting
  // integrations to a closed SDK-owned authorization enumeration.
  expect(authorizations.map((authorization) => authorization.kind)).toEqual([
    "http.bearer",
    "application.session.exchange",
  ]);
});

it("allows concrete schemes to add typed configuration structurally", () => {
  const applicationAuthorization = {
    kind: "application.signed-request",
    keyId: "application-key",
    algorithm: "custom-v1",
  } as const;
  const authorization: Authorization = applicationAuthorization;

  // Structural extension preserves application-owned fields on the original
  // object while the shared abstraction exposes only its selection discriminator.
  expect(authorization.kind).toBe("application.signed-request");
  expect(applicationAuthorization.keyId).toBe("application-key");
  expect(applicationAuthorization.algorithm).toBe("custom-v1");
});

it("requires kind and does not impose unrelated base fields", () => {
  // A missing discriminator cannot select a handler, while kind alone completely
  // satisfies the intentionally minimal base contract.
  expectTypeOf<Record<string, never>>().not.toMatchTypeOf<Authorization>();
  expectTypeOf<{ readonly kind: OpenIdentifier }>().toMatchTypeOf<Authorization>();
});

it("prevents authorization kind replacement at compile time", () => {
  const proveReadonly = (authorization: Authorization): void => {
    // Attempt the only base-field write solely for compile-time verification;
    // this helper is never called and therefore mutates no runtime object.
    // @ts-expect-error Authorization kind is immutable after construction.
    authorization.kind = "changed.authorization";
  };

  // Retain the helper in the compiled test so an unused function cannot hide the
  // readonly assertion from the TypeScript checker.
  expectTypeOf(proveReadonly).toBeFunction();
});
