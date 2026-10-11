// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Authorization } from "@evolutos/mconet-core-domain";

import { noAuthorizationKind, type NoAuthorization } from "./no-authorization.js";

it("fixes the no-authorization kind and carries no credential fields", () => {
  // The scheme is assignable to the open authorization contract, but its kind
  // cannot widen to an arbitrary identifier or another concrete scheme.
  expectTypeOf<NoAuthorization>().toMatchTypeOf<Authorization>();
  expectTypeOf<NoAuthorization["kind"]>().toEqualTypeOf<"authorization.none">();
  expectTypeOf<{ readonly kind: string }>().not.toMatchTypeOf<NoAuthorization>();
  expectTypeOf<{ readonly kind: "authorization.bearer" }>().not.toMatchTypeOf<NoAuthorization>();
  expectTypeOf<NoAuthorization>().toEqualTypeOf<{
    readonly kind: "authorization.none";
  }>();

  const authorization: NoAuthorization = { kind: noAuthorizationKind };
  const base: Authorization = authorization;

  expect(noAuthorizationKind).toBe("authorization.none");
  expect(authorization.kind).toBe("authorization.none");
  expect(base.kind).toBe(noAuthorizationKind);
});

it("prevents replacing the fixed no-authorization kind", () => {
  const proveReadonly = (authorization: NoAuthorization): void => {
    // Exercise the prohibited write only during type checking. The helper is
    // never called, so it cannot change a live authorization description.
    // @ts-expect-error The no-authorization kind is a fixed literal.
    authorization.kind = "authorization.bearer";
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
