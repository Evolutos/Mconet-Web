// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Authorization } from "@evolutos/mconet-core-domain";
import type { CredentialSource } from "@evolutos/mconet-core-spi";

import {
  apiKeyHeaderAuthorizationKind,
  type ApiKeyHeaderAuthorization,
} from "./api-key-header-authorization.js";

it("separates the fixed kind, header name, and credential source", () => {
  const credentialSource: CredentialSource = {
    async getCredential() {
      throw new Error("credential source must not be read while describing authorization");
    },
  };
  const authorization: ApiKeyHeaderAuthorization = {
    kind: apiKeyHeaderAuthorizationKind,
    headerName: "x-api-key",
    credentialSource,
  };
  const base: Authorization = authorization;

  // The three fields remain distinct. The description does not embed a header
  // value, and constructing it does not invoke the credential source.
  expectTypeOf<ApiKeyHeaderAuthorization>().toMatchTypeOf<Authorization>();
  expectTypeOf<ApiKeyHeaderAuthorization>().toEqualTypeOf<{
    readonly kind: "authorization.api-key-header";
    readonly headerName: string;
    readonly credentialSource: CredentialSource;
  }>();
  expectTypeOf<ApiKeyHeaderAuthorization["kind"]>().toEqualTypeOf<"authorization.api-key-header">();
  expectTypeOf<{
    readonly kind: "authorization.api-key-header";
    readonly headerName: string;
  }>().not.toMatchTypeOf<ApiKeyHeaderAuthorization>();
  expect(apiKeyHeaderAuthorizationKind).toBe("authorization.api-key-header");
  expect(authorization.headerName).toBe("x-api-key");
  expect(authorization.credentialSource).toBe(credentialSource);
  expect(base.kind).toBe(apiKeyHeaderAuthorizationKind);
  expect(authorization).not.toHaveProperty("headerValue");
  expect(authorization).not.toHaveProperty("value");
});

it("prevents replacing the api-key header authorization fields", () => {
  const proveReadonly = (authorization: ApiKeyHeaderAuthorization): void => {
    // Compile-only writes prove the description is immutable. The helper is
    // never called and therefore cannot change a live value.
    // @ts-expect-error The scheme kind is a fixed literal.
    authorization.kind = "authorization.none";
    // @ts-expect-error The header name is part of the immutable description.
    authorization.headerName = "authorization";
    // @ts-expect-error The credential source cannot be replaced through the description.
    authorization.credentialSource = {
      async getCredential() {
        throw new Error("replacement");
      },
    };
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
