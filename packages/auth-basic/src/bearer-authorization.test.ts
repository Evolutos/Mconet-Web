// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Authorization } from "@evolutos/mconet-core-domain";
import type { CredentialSource } from "@evolutos/mconet-core-spi";

import { bearerAuthorizationKind, type BearerAuthorization } from "./bearer-authorization.js";

it("requires a credential source and fixes the bearer kind", () => {
  const credentialSource: CredentialSource = {
    async getCredential() {
      throw new Error("credential source must not be read while describing authorization");
    },
  };
  const authorization: BearerAuthorization = {
    kind: bearerAuthorizationKind,
    credentialSource,
  };
  const base: Authorization = authorization;

  // The source is part of the description, while the token and header name are
  // not. Creating the description does not resolve the credential.
  expectTypeOf<BearerAuthorization>().toMatchTypeOf<Authorization>();
  expectTypeOf<BearerAuthorization>().toEqualTypeOf<{
    readonly kind: "authorization.bearer";
    readonly credentialSource: CredentialSource;
  }>();
  expectTypeOf<BearerAuthorization["kind"]>().toEqualTypeOf<"authorization.bearer">();
  expectTypeOf<{
    readonly kind: "authorization.bearer";
  }>().not.toMatchTypeOf<BearerAuthorization>();
  expectTypeOf<BearerAuthorization>().not.toHaveProperty("headerName");
  expectTypeOf<BearerAuthorization>().not.toHaveProperty("token");
  expect(bearerAuthorizationKind).toBe("authorization.bearer");
  expect(authorization.credentialSource).toBe(credentialSource);
  expect(base.kind).toBe(bearerAuthorizationKind);
});

it("prevents replacing the bearer authorization fields", () => {
  const proveReadonly = (authorization: BearerAuthorization): void => {
    // Compile-only writes prove the description is immutable. The helper is
    // never called and therefore cannot change a live value.
    // @ts-expect-error The scheme kind is a fixed literal.
    authorization.kind = "authorization.none";
    // @ts-expect-error The credential source cannot be replaced through the description.
    authorization.credentialSource = {
      async getCredential() {
        throw new Error("replacement");
      },
    };
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
